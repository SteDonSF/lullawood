// =============================================================================
// /api/cron/health-check  —  the daily "is anything broken?" run
// -----------------------------------------------------------------------------
// WHAT: eight checks against the live site, Plausible, and the database. Emails
//   ONE message listing every breach — and nothing at all when nothing breached.
//   Silence is the feature: an email in the inbox always means "look at this".
// TRIGGER: the lullawood-healthcheck Worker (workers/healthcheck) owns both
//   crons and fires this twice a day:
//     14:00 UTC (7am PT)  ->  ?mode=daily     checks 1-7, incl. the canary
//     19:00 UTC           ->  ?mode=delivery  check 8, AFTER the 18:00 nightly
//   The split is the whole point: at 14:00 tonight's stories don't exist yet, so
//   running the delivery check then would flag every child, every day.
// SECURITY: same pattern as the weekly digest and the other cron routes —
//   Authorization: Bearer <CRON_SECRET>, 401 on any mismatch. Not behind
//   Cloudflare Access, because a Worker cannot pass an Access check; the shared
//   secret is the wall.
// DRY RUN: ?dry=1 renders the full report AND sends it, even with nothing
//   breached, so the numbers can be seen on demand. (This differs from the
//   digest's ?dry=1, which renders without sending — here the point is to prove
//   the whole path, delivery included, still works.)
//
// WHAT IT REUSES: api_events and metrics_daily (0005_admin_metrics.sql),
//   src/lib/plausible.ts for the Stats API, and src/lib/metrics.ts for the SQL.
//   The only thing it adds is page_speed — an outside-in measurement of the
//   public site, which is not a request log and doesn't belong in api_events.
//
// TUNING: every threshold lives in CONFIG below. Change a number there — never
//   in the logic underneath it.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { getDeliveryVerification, getGenerationErrors, getNightlyCronHealth } from "@/lib/metrics";
import { fetchVisitors, lastHours, plausibleConfigured } from "@/lib/plausible";
import { sendHealthAlertEmail } from "@/lib/resend";

export const runtime = "edge";

// =============================================================================
// CONFIG — every threshold, window and target. Tune here.
// =============================================================================
const CONFIG = {
  site: "https://lullawood.com",

  // Same convention as the digest's DIGEST_TO.
  alertTo: process.env.HEALTHCHECK_TO || "stephenpdonnelly@gmail.com",

  // --- 1. PAGE SPEED (PageSpeed Insights — free, no key needed at this volume) ---
  pageSpeed: {
    paths: ["/", "/try"],
    strategy: "mobile",          // where bedtime traffic actually is
    maxLcpMs: 3500,              // ALERT above this
    minPerformanceScore: 50,     // ALERT below this (0-100)
    timeoutMs: 60_000,           // PSI is slow; both pages run in parallel
  },

  // --- 2. UPTIME + LATENCY ---
  uptime: {
    // HEAD on the pages; OPTIONS on the API so the route is pinged without
    // burning a story generation. Next answers OPTIONS for a route handler, but
    // a 405 is an equally healthy "the route is there" — hence alsoOk.
    targets: [
      { path: "/", method: "HEAD" as const, alsoOk: [] as number[] },
      { path: "/try", method: "HEAD" as const, alsoOk: [] as number[] },
      { path: "/pricing", method: "HEAD" as const, alsoOk: [] as number[] },
      { path: "/api/generate-story", method: "OPTIONS" as const, alsoOk: [405] },
    ],
    maxTtfbMs: 2000,             // ALERT above this
    timeoutMs: 15_000,
  },

  // --- 3. FUNNEL RATE (Plausible) ---
  funnel: {
    windowHours: 24,
    goal: "demo_started" as const,
    pages: ["/", "/try"],        // visitors to these are the denominator
    minRate: 0.06,               // ALERT below 6%...
    minVisitors: 50,             // ...but only once there's enough volume to mean anything
  },

  // --- 4. CONVERSION DROUGHT (Plausible) ---
  conversion: {
    windowHours: 48,
    goal: "signup_completed" as const,
    minVisitors: 150,            // ALERT only if this many visitors produced zero signups
  },

  // --- 5. CRON HEALTH (nightly story delivery) ---
  cron: {
    windowHours: 26,             // the 18:00 UTC nightly run + slack, seen from a 14:00 UTC check
  },

  // --- 7. SYNTHETIC CANARY (runs with the 14:00 daily set) ---
  // Exercises the REAL path end to end — generation, DB write, Resend send — by
  // calling the nightly cron's own test hooks (?force=1&childId=) rather than
  // reimplementing any of it. Whatever breaks for a canary breaks for a customer.
  // Needs a dedicated child on an account with an active/trialing subscription,
  // whose parent email is a canary inbox. Unset -> the check skips, never alerts.
  canary: {
    childId: process.env.CANARY_CHILD_ID || "",
    maxMs: 60_000,               // ALERT above this, end to end
    abortMs: 90_000,             // ...but let it finish past the threshold so the
                                 // alert can name a real duration, not "timed out"
  },

  // --- 8. STORY DELIVERY (runs at 19:00 UTC, after the nightly job) ---
  delivery: {
    // Hour of the nightly run, UTC. Used to exclude children created after
    // tonight's run started — an evening signup has no story yet and is not a
    // failure. Keep in step with workers/nightly/wrangler.toml.
    nightlyHourUtc: 18,
    maxFailuresListed: 25,       // one line each; a full outage shouldn't email 400
  },

  // --- 6. ERROR RATE (api_events, route 'generate-story') ---
  errorRate: {
    windowHours: 24,
    maxRate: 0.05,               // ALERT above 5% of requests
    minRequests: 20,             // ...but only with enough traffic; 1-of-1 isn't a 100% error rate
    // These feed the SQL filter directly, so editing them really does change
    // what the check counts.
    errorStatuses: [402, 429],   // payment-required + rate-limited
    serverErrorFrom: 500,        // ...plus anything at or above this
  },
};

// =============================================================================
// Report model. Every check returns one CheckResult; breaches become the email.
// =============================================================================
type Status = "pass" | "alert" | "skipped" | "error";

/** One line of the email: the metric, its value, the threshold, and where. */
type Breach = { metric: string; value: string; threshold: string; target: string };

type CheckResult = {
  name: string;
  status: Status;
  detail: string;               // one line for the full (?dry=1) report
  breaches: Breach[];
};

const breachLine = (b: Breach) => `${b.metric} — ${b.value} (threshold ${b.threshold}) — ${b.target}`;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const secs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const asInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** fetch with a hard timeout — no single check may hang the whole run. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// 1. PAGE SPEED — measure both pages, record every run, alert on a bad LCP or
//    a bad performance score.
// =============================================================================
async function checkPageSpeed(db: ReturnType<typeof getDb>): Promise<CheckResult> {
  const { paths, strategy, maxLcpMs, minPerformanceScore, timeoutMs } = CONFIG.pageSpeed;
  const breaches: Breach[] = [];
  const details: string[] = [];
  let errored = false;

  const runs = await Promise.all(
    paths.map(async (path) => {
      const target = `${CONFIG.site}${path}`;
      const key = process.env.PAGESPEED_API_KEY;
      const api =
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
        `?url=${encodeURIComponent(target)}&strategy=${strategy}&category=performance` +
        (key ? `&key=${encodeURIComponent(key)}` : "");
      try {
        const res = await fetchWithTimeout(api, { headers: { accept: "application/json" } }, timeoutMs);
        if (!res.ok) throw new Error(`PSI HTTP ${res.status}`);
        const json = (await res.json()) as any;
        const lh = json?.lighthouseResult;
        const rawScore = lh?.categories?.performance?.score;
        return {
          path,
          target,
          score: typeof rawScore === "number" ? Math.round(rawScore * 100) : null,
          lcpMs: asInt(lh?.audits?.["largest-contentful-paint"]?.numericValue),
          tbtMs: asInt(lh?.audits?.["total-blocking-time"]?.numericValue),
          ttfbMs: asInt(lh?.audits?.["server-response-time"]?.numericValue),
          error: null as string | null,
        };
      } catch (e) {
        return { path, target, score: null, lcpMs: null, tbtMs: null, ttfbMs: null, error: msg(e) };
      }
    }),
  );

  for (const r of runs) {
    if (r.error) {
      errored = true;
      details.push(`${r.path}: PageSpeed lookup failed — ${r.error}`);
      breaches.push({ metric: "PageSpeed lookup", value: `failed (${r.error})`, threshold: "must return a result", target: r.target });
      continue;
    }

    // Record every measurement, breach or not — this is the trend the admin
    // dashboard reads under Product health.
    try {
      await db.insert(schema.pageSpeed).values({
        path: r.path,
        strategy,
        performanceScore: r.score,
        lcpMs: r.lcpMs,
        tbtMs: r.tbtMs,
        ttfbMs: r.ttfbMs,
      });
    } catch (e) {
      console.error("health-check: page_speed insert failed —", msg(e));
    }

    details.push(
      `${r.path}: score ${r.score ?? "—"}, LCP ${r.lcpMs != null ? secs(r.lcpMs) : "—"}, ` +
      `TBT ${r.tbtMs != null ? `${r.tbtMs}ms` : "—"}, TTFB ${r.ttfbMs != null ? `${r.ttfbMs}ms` : "—"}`,
    );

    if (r.lcpMs != null && r.lcpMs > maxLcpMs) {
      breaches.push({ metric: "LCP (mobile)", value: secs(r.lcpMs), threshold: `${secs(maxLcpMs)} max`, target: r.target });
    }
    if (r.score != null && r.score < minPerformanceScore) {
      breaches.push({ metric: "Performance score (mobile)", value: String(r.score), threshold: `${minPerformanceScore} min`, target: r.target });
    }
  }

  return {
    name: "Page speed",
    status: breaches.length ? (errored ? "error" : "alert") : "pass",
    detail: details.join(" · "),
    breaches,
  };
}

// =============================================================================
// 2. UPTIME + LATENCY — every target must answer 2xx, fast.
// =============================================================================
async function checkUptime(): Promise<CheckResult> {
  const { targets, maxTtfbMs, timeoutMs } = CONFIG.uptime;
  const breaches: Breach[] = [];
  const details: string[] = [];

  const results = await Promise.all(
    targets.map(async (t) => {
      const target = `${CONFIG.site}${t.path}`;
      const started = Date.now();
      try {
        // The awaited fetch resolves on response headers, so this elapsed time
        // is TTFB, not a full body download.
        const res = await fetchWithTimeout(target, { method: t.method, headers: { "x-health-check": "1" } }, timeoutMs);
        return { ...t, target, status: res.status, elapsed: Date.now() - started, error: null as string | null };
      } catch (e) {
        return { ...t, target, status: 0, elapsed: Date.now() - started, error: msg(e) };
      }
    }),
  );

  for (const r of results) {
    const healthy = r.error === null && ((r.status >= 200 && r.status < 300) || r.alsoOk.includes(r.status));
    details.push(`${r.method} ${r.path}: ${r.error ? `failed (${r.error})` : r.status} in ${r.elapsed}ms`);

    if (!healthy) {
      breaches.push({
        metric: `Uptime (${r.method})`,
        value: r.error ? `request failed — ${r.error}` : `HTTP ${r.status}`,
        threshold: r.alsoOk.length ? `2xx (or ${r.alsoOk.join("/")})` : "2xx",
        target: r.target,
      });
    }
    // Latency is only meaningful on a response we actually got.
    if (r.error === null && r.elapsed > maxTtfbMs) {
      breaches.push({ metric: "TTFB", value: secs(r.elapsed), threshold: `${secs(maxTtfbMs)} max`, target: r.target });
    }
  }

  return { name: "Uptime + latency", status: breaches.length ? "alert" : "pass", detail: details.join(" · "), breaches };
}

// A Plausible check that can't run because the key is missing is SKIPPED, not
// breached — an unconfigured check is not a product failure. A key that IS set
// and fails is reported: a check that should have run and didn't is worth an
// alert of its own.
const notConfigured = (name: string): CheckResult => ({
  name,
  status: "skipped",
  detail: "skipped — PLAUSIBLE_API_KEY is not set",
  breaches: [],
});

// =============================================================================
// 3. FUNNEL RATE — demo_started ÷ unique visitors on / and /try, last 24h.
//    Below the volume floor we stay silent: it isn't a signal yet.
// =============================================================================
async function checkFunnel(): Promise<CheckResult> {
  const name = "Funnel rate";
  if (!plausibleConfigured()) return notConfigured(name);

  const { windowHours, goal, pages, minRate, minVisitors } = CONFIG.funnel;
  const range = lastHours(windowHours);
  const target = `${CONFIG.site} ${pages.join(" + ")}`;

  try {
    // Both sides are UNIQUE VISITORS, so the ratio is people ÷ people rather
    // than events ÷ people — one visitor hammering the demo can't fake a rate.
    const [visitors, converted] = await Promise.all([
      fetchVisitors(range, { pages }),
      fetchVisitors(range, { goal }),
    ]);

    if (visitors < minVisitors) {
      return {
        name,
        status: "pass",
        detail: `${converted}/${visitors} visitors in ${windowHours}h — below the ${minVisitors}-visitor floor, not a signal yet`,
        breaches: [],
      };
    }

    const rate = visitors > 0 ? converted / visitors : 0;
    const breaches: Breach[] =
      rate < minRate
        ? [{
            metric: `${goal} rate (${windowHours}h)`,
            value: `${pct(rate)} (${converted} of ${visitors} visitors)`,
            threshold: `${pct(minRate)} min, at ${minVisitors}+ visitors`,
            target,
          }]
        : [];

    return {
      name,
      status: breaches.length ? "alert" : "pass",
      detail: `${pct(rate)} — ${converted} of ${visitors} visitors in ${windowHours}h`,
      breaches,
    };
  } catch (e) {
    return {
      name,
      status: "error",
      detail: `Plausible query failed — ${msg(e)}`,
      breaches: [{ metric: "Funnel check", value: `could not run — ${msg(e)}`, threshold: "Plausible must answer", target }],
    };
  }
}

// =============================================================================
// 4. CONVERSION DROUGHT — real traffic over 48h producing zero signups.
// =============================================================================
async function checkConversionDrought(): Promise<CheckResult> {
  const name = "Conversion drought";
  if (!plausibleConfigured()) return notConfigured(name);

  const { windowHours, goal, minVisitors } = CONFIG.conversion;
  const range = lastHours(windowHours);

  try {
    const [visitors, signups] = await Promise.all([
      fetchVisitors(range),
      fetchVisitors(range, { goal }),
    ]);

    const breaches: Breach[] =
      visitors >= minVisitors && signups === 0
        ? [{
            metric: `${goal} (${windowHours}h)`,
            value: `0 signups from ${visitors} visitors`,
            threshold: `>0 expected at ${minVisitors}+ visitors`,
            target: CONFIG.site,
          }]
        : [];

    return {
      name,
      status: breaches.length ? "alert" : "pass",
      detail: `${signups} signups from ${visitors} visitors in ${windowHours}h`,
      breaches,
    };
  } catch (e) {
    return {
      name,
      status: "error",
      detail: `Plausible query failed — ${msg(e)}`,
      breaches: [{ metric: "Conversion check", value: `could not run — ${msg(e)}`, threshold: "Plausible must answer", target: CONFIG.site }],
    };
  }
}

// =============================================================================
// 5. CRON HEALTH — did the nightly run, and did it actually deliver?
//    "Ran" is true if the cron left a marker in api_events OR nightly stories
//    exist in the window; the second half keeps this honest for the nights
//    before the marker started being written.
// =============================================================================
async function checkCronHealth(): Promise<CheckResult> {
  const name = "Cron health";
  const { windowHours } = CONFIG.cron;
  const target = "/api/cron/nightly-stories";

  try {
    const { runs, delivered, activeSubscriptions } = await getNightlyCronHealth(windowHours);
    const ran = runs > 0 || delivered > 0;

    const breaches: Breach[] = [];
    if (!ran) {
      breaches.push({
        metric: `Nightly cron run (${windowHours}h)`,
        value: "no run recorded",
        threshold: "1 run per night",
        target,
      });
    } else if (delivered === 0 && activeSubscriptions > 0) {
      breaches.push({
        metric: "stories_delivered (last night)",
        value: `0, with ${activeSubscriptions} active subscription${activeSubscriptions === 1 ? "" : "s"}`,
        threshold: ">0 whenever active subscriptions > 0",
        target,
      });
    }

    return {
      name,
      status: breaches.length ? "alert" : "pass",
      detail: `${runs} run${runs === 1 ? "" : "s"} logged, ${delivered} nightly stories delivered, ${activeSubscriptions} active subs`,
      breaches,
    };
  } catch (e) {
    return {
      name,
      status: "error",
      detail: `query failed — ${msg(e)}`,
      breaches: [{ metric: "Cron health check", value: `could not run — ${msg(e)}`, threshold: "query must succeed", target }],
    };
  }
}

// =============================================================================
// 6. ERROR RATE — 402s / 429s / 5xx as a share of story generations, last 24h.
// =============================================================================
async function checkErrorRate(): Promise<CheckResult> {
  const name = "Error rate";
  const { windowHours, maxRate, minRequests, errorStatuses, serverErrorFrom } = CONFIG.errorRate;
  const target = `${CONFIG.site}/api/generate-story`;

  try {
    const { total, errors } = await getGenerationErrors(windowHours, errorStatuses, serverErrorFrom);

    if (total < minRequests) {
      return {
        name,
        status: "pass",
        detail: `${errors}/${total} errors in ${windowHours}h — below the ${minRequests}-request floor`,
        breaches: [],
      };
    }

    const rate = errors / total;
    const breaches: Breach[] =
      rate > maxRate
        ? [{
            metric: `${errorStatuses.join("/")}/${serverErrorFrom}+ rate (${windowHours}h)`,
            value: `${pct(rate)} (${errors} of ${total} requests)`,
            threshold: `${pct(maxRate)} max`,
            target,
          }]
        : [];

    return {
      name,
      status: breaches.length ? "alert" : "pass",
      detail: `${pct(rate)} — ${errors} of ${total} requests in ${windowHours}h`,
      breaches,
    };
  } catch (e) {
    return {
      name,
      status: "error",
      detail: `query failed — ${msg(e)}`,
      breaches: [{ metric: "Error-rate check", value: `could not run — ${msg(e)}`, threshold: "query must succeed", target }],
    };
  }
}

// =============================================================================
// 7. SYNTHETIC CANARY — generate and send one real story, end to end.
//    Calls the nightly cron's own secret-gated test hooks instead of
//    reimplementing generation: ?childId= confines the run to the canary child
//    (no collateral email to anyone else) and ?force=1 bypasses the once-a-day
//    idempotency so it actually generates rather than skipping.
// =============================================================================
async function checkCanary(secret: string): Promise<CheckResult> {
  const name = "Synthetic canary";
  const { childId, maxMs, abortMs } = CONFIG.canary;
  if (!childId) {
    return { name, status: "skipped", detail: "skipped — CANARY_CHILD_ID is not set", breaches: [] };
  }

  const target = `${CONFIG.site}/api/cron/nightly-stories`;
  const url = `${target}?force=1&childId=${encodeURIComponent(childId)}`;
  const started = Date.now();

  const fail = (value: string, elapsed: number): CheckResult => ({
    name,
    status: "alert",
    detail: `FAILED after ${secs(elapsed)} — ${value}`,
    breaches: [{ metric: "Canary story (generate + save + send)", value, threshold: `must succeed within ${secs(maxMs)}`, target }],
  });

  let elapsed = 0;
  try {
    const res = await fetchWithTimeout(url, { headers: { authorization: `Bearer ${secret}` } }, abortMs);
    elapsed = Date.now() - started;

    if (!res.ok) return fail(`HTTP ${res.status} from the nightly route`, elapsed);

    const body = (await res.json()) as any;
    // total 0 means the child wasn't reachable at all — wrong id, inactive
    // child, or the canary account's subscription lapsed. All are real breaks.
    if (!body?.ok) return fail(`nightly route returned ok=false (${body?.error ?? "no reason given"})`, elapsed);
    if (Number(body.total ?? 0) === 0) {
      return fail("canary child not found on any active/trialing subscription", elapsed);
    }
    if (Number(body.succeeded ?? 0) < 1) {
      const why = body?.results?.[0]?.error ?? "no reason given";
      return fail(`generation failed — ${String(why).slice(0, 160)}`, elapsed);
    }
    const emailError = body?.results?.[0]?.emailError;
    if (emailError) return fail(`story generated but the send failed — ${String(emailError).slice(0, 160)}`, elapsed);

    // Generated and sent. The only thing left to judge is how long it took.
    if (elapsed > maxMs) {
      return {
        name,
        status: "alert",
        detail: `succeeded, but in ${secs(elapsed)}`,
        breaches: [{ metric: "Canary end-to-end duration", value: secs(elapsed), threshold: `${secs(maxMs)} max`, target }],
      };
    }

    return { name, status: "pass", detail: `generated, saved and sent in ${secs(elapsed)}`, breaches: [] };
  } catch (e) {
    elapsed = Date.now() - started;
    // An abort here means it blew well past the threshold, not that we can't tell.
    const why = elapsed >= abortMs ? `no response within ${secs(abortMs)}` : msg(e);
    return fail(why, elapsed);
  }
}

// =============================================================================
// 8. STORY DELIVERY — every child on an active sub got a story AND a send id.
//    Runs at 19:00 UTC, after the 18:00 nightly. A story row alone isn't
//    delivery: this fails a child whose story exists but was never mailed.
// =============================================================================
async function checkDelivery(): Promise<CheckResult> {
  const name = "Story delivery";
  const { nightlyHourUtc, maxFailuresListed } = CONFIG.delivery;
  const target = "/api/cron/nightly-stories";

  try {
    const { expected, verified, failures, truncated } = await getDeliveryVerification(nightlyHourUtc, maxFailuresListed);

    if (expected === 0) {
      return { name, status: "pass", detail: "no children on an active subscription tonight", breaches: [] };
    }

    // One line per child, naming which half failed — a missing story and a
    // story that never got mailed are different bugs in different places.
    const breaches: Breach[] = failures.map((f) => ({
      metric: `Delivery — ${f.childName}`,
      value: !f.hasStory
        ? "no story written tonight"
        : "story written but no Resend id logged",
      threshold: "story + send id",
      target: `${f.parentEmail} (child ${f.childId})`,
    }));

    if (truncated) {
      breaches.push({
        metric: "Delivery failures",
        value: `${expected - verified} total, first ${maxFailuresListed} listed`,
        threshold: "all children delivered",
        target,
      });
    }

    return {
      name,
      status: breaches.length ? "alert" : "pass",
      detail: `${verified}/${expected} children verified (story + Resend id)`,
      breaches,
    };
  } catch (e) {
    return {
      name,
      status: "error",
      detail: `query failed — ${msg(e)}`,
      breaches: [{ metric: "Delivery check", value: `could not run — ${msg(e)}`, threshold: "query must succeed", target }],
    };
  }
}

// =============================================================================
// The run.
// =============================================================================
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });

  const provided = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const dry = params.get("dry") === "1";

  // TWO SCHEDULES, ONE ROUTE. The daily set runs at 14:00 UTC. The delivery
  // check runs at 19:00, an hour after the nightly job — at 14:00 tonight's
  // stories don't exist yet, so it would flag every child, every day.
  //   (default)        -> checks 1-7
  //   ?mode=delivery   -> check 8 only
  //   ?mode=all        -> everything, for an on-demand look after 19:00
  const mode = (params.get("mode") || "daily").toLowerCase();
  if (!["daily", "delivery", "all"].includes(mode)) {
    return NextResponse.json({ error: "bad_mode", allowed: ["daily", "delivery", "all"] }, { status: 400 });
  }
  const runDaily = mode === "daily" || mode === "all";
  const runDelivery = mode === "delivery" || mode === "all";

  const startedAt = Date.now();
  const db = getDb();

  // Every check is independent — run them together and let each own its errors,
  // so one failing check can never hide the others.
  const checks = (
    await Promise.all([
      ...(runDaily
        ? [
            checkPageSpeed(db),
            checkUptime(),
            checkFunnel(),
            checkConversionDrought(),
            checkCronHealth(),
            checkErrorRate(),
            checkCanary(secret),
          ]
        : []),
      ...(runDelivery ? [checkDelivery()] : []),
    ])
  );

  const breaches = checks.flatMap((c) => c.breaches);
  const lines = breaches.map(breachLine);
  const reportLines = checks.map((c) => `[${c.status.toUpperCase()}] ${c.name}: ${c.detail}`);

  const subject = breaches.length
    ? `Lullawood alert — ${breaches.length} issue${breaches.length === 1 ? "" : "s"}`
    : "Lullawood health check — all clear";

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const body = [
    `Lullawood — health check ${stamp} UTC (${mode})`,
    "",
    ...(breaches.length ? lines.map((l) => `- ${l}`) : ["Nothing breached a threshold."]),
    // The real alert is the breach list alone. A ?dry=1 run also carries the
    // full report, which is the whole reason to ask for one.
    ...(dry ? ["", "FULL REPORT", ...reportLines] : []),
    "",
    "Dashboard: https://lullawood.com/admin/dashboard",
  ].join("\n");

  // THE RULE: email only on a breach. ?dry=1 always sends.
  let emailed = false;
  let emailError: string | undefined;
  if (breaches.length > 0 || dry) {
    const sent = await sendHealthAlertEmail(CONFIG.alertTo, subject, body);
    emailed = sent.success;
    emailError = sent.error;
  }

  const durationMs = Date.now() - startedAt;

  // Log the run into the same thin request log everything else uses, so a health
  // check that quietly stops running is itself visible.
  try {
    await db.insert(schema.apiEvents).values({
      route: "cron-health-check",
      status: 200,
      durationMs,
      detail: `mode=${mode} breaches=${breaches.length}${dry ? " dry=1" : ""}${emailed ? " emailed" : ""}`,
    });
  } catch {
    /* the log is diagnostics, never a dependency */
  }

  console.log(`health-check[${mode}]: ${breaches.length} breach(es) in ${durationMs}ms${dry ? " (dry)" : ""}${emailed ? " — emailed" : ""}`);

  return NextResponse.json({
    ok: true,
    mode,
    dry,
    durationMs,
    breachCount: breaches.length,
    emailed,
    ...(emailError ? { emailError } : {}),
    subject,
    breaches: lines,
    checks: checks.map(({ name, status, detail }) => ({ name, status, detail })),
  });
}
