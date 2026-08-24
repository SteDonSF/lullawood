// =============================================================================
// /api/cron/health-check  —  the daily "is anything broken?" run
// -----------------------------------------------------------------------------
// WHAT: runs six automated checks against the live site and the database, records
//   what it measured, and emails ONE alert listing every breach. If nothing
//   breached a threshold it sends nothing at all — silence means everything
//   passed. That silence is the feature: an email always means "look at this".
// TRIGGER: the lullawood-healthcheck Cron Worker (workers/healthcheck) fetches
//   this URL daily at 14:00 UTC / 7am PT. Pages Functions can't own a cron.
// SECURITY: not public. Caller must send  Authorization: Bearer <CRON_SECRET>
//   — the same shared secret as the other crons. Any mismatch -> 401.
// ON DEMAND: add ?dry=1 to render the full report and send the email even when
//   nothing breached, so you can see the numbers whenever you want. Still gated
//   by CRON_SECRET; ?dry=1 does NOT skip the page_speed write (the run is real).
//
// TUNING: every threshold lives in CONFIG below. Change a number there — never
//   in the logic underneath it.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { sendHealthAlertEmail } from "@/lib/resend";

export const runtime = "edge";

// =============================================================================
// CONFIG — every threshold, window and target. Tune here.
// =============================================================================
const CONFIG = {
  // The origin every check measures against.
  site: "https://lullawood.com",

  // Where the alert lands. HEALTHCHECK_ALERT_TO wins; WAITLIST_NOTIFY is the
  // fallback so this works with the env vars the project already has. If NEITHER
  // is set the run still executes and reports, but can't email — and says so.
  alertTo: process.env.HEALTHCHECK_ALERT_TO || process.env.WAITLIST_NOTIFY || "",

  // --- 1. PAGE SPEED (Google PageSpeed Insights, free tier, no key needed) ---
  pageSpeed: {
    paths: ["/", "/try"],
    strategy: "mobile",          // where bedtime traffic actually is
    maxLcpMs: 3500,              // ALERT above this
    minPerformanceScore: 50,     // ALERT below this (0-100)
    timeoutMs: 60_000,           // PSI is slow; both pages run in parallel
  },

  // --- 2. UPTIME + LATENCY ---
  uptime: {
    // HEAD on the pages; OPTIONS on the API so we ping the route without
    // burning a story generation. Next auto-answers OPTIONS for a route handler,
    // but 405 is an equally healthy "the route is there" — hence alsoOk.
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
    goal: "demo_started",
    pages: ["/", "/try"],        // visitors to these are the denominator
    minRate: 0.06,               // ALERT below 6%...
    minVisitors: 50,             // ...but only once there's enough volume to mean anything
  },

  // --- 4. CONVERSION DROUGHT (Plausible) ---
  conversion: {
    windowHours: 48,
    goal: "signup_completed",
    minVisitors: 150,            // ALERT only if this many visitors produced zero signups
  },

  // --- 5. CRON HEALTH (nightly story delivery) ---
  cron: {
    route: "/api/cron/nightly-stories",
    windowHours: 26,             // the 18:00 UTC nightly run + slack, seen from a 14:00 UTC check
  },

  // --- 6. ERROR RATE (api_events) ---
  errorRate: {
    route: "/api/generate-story",
    windowHours: 24,
    maxRate: 0.05,               // ALERT above 5% of requests
    minRequests: 20,             // ...but only with enough traffic; 1-of-1 isn't a 100% error rate
    // What counts as an error. These feed the SQL filter directly, so editing
    // them here really does change what the check counts.
    errorStatuses: [402, 429],   // payment-required + rate-limited
    serverErrorFrom: 500,        // ...plus anything at or above this
  },

  // Plausible Stats API. Self-hosters point PLAUSIBLE_HOST elsewhere. When the
  // key or site id is missing, checks 3 + 4 report "skipped" and stay silent —
  // an unconfigured check is not a breach. When they ARE configured and the API
  // errors, that IS reported: a check that can't run is worth knowing about.
  plausible: {
    host: process.env.PLAUSIBLE_HOST || "https://plausible.io",
    siteId: process.env.PLAUSIBLE_SITE_ID || "",
    apiKey: process.env.PLAUSIBLE_API_KEY || "",
    timeoutMs: 15_000,
  },
};

// =============================================================================
// Report model. Every check returns one CheckResult; breaches become the email.
// =============================================================================
type Status = "pass" | "alert" | "skipped" | "error";

// One line of the email: the metric, its value, the threshold it broke, and
// where. Formatted by breachLine() so every line reads the same way.
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

// fetch with a hard timeout — no check may hang the whole run.
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
// 1. PAGE SPEED — PageSpeed Insights for each path; record every run, alert on
//    a bad LCP or a bad performance score.
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
      } catch (err) {
        return { path, target, score: null, lcpMs: null, tbtMs: null, ttfbMs: null, error: err instanceof Error ? err.message : String(err) };
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

    // Record every measurement, breach or not — this table is the trend the
    // admin dashboard reads.
    try {
      await db.insert(schema.pageSpeed).values({
        path: r.path,
        strategy,
        performanceScore: r.score,
        lcpMs: r.lcpMs,
        tbtMs: r.tbtMs,
        ttfbMs: r.ttfbMs,
      });
    } catch (err) {
      console.error("health-check: page_speed insert failed —", err instanceof Error ? err.message : String(err));
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
        // is TTFB, not full body download.
        const res = await fetchWithTimeout(target, { method: t.method, headers: { "x-health-check": "1" } }, timeoutMs);
        return { ...t, target, status: res.status, ms: Date.now() - started, error: null as string | null };
      } catch (err) {
        return { ...t, target, status: 0, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  for (const r of results) {
    const healthy = r.error === null && ((r.status >= 200 && r.status < 300) || r.alsoOk.includes(r.status));
    details.push(`${r.method} ${r.path}: ${r.error ? `failed (${r.error})` : r.status} in ${r.ms}ms`);

    if (!healthy) {
      breaches.push({
        metric: `Uptime (${r.method})`,
        value: r.error ? `request failed — ${r.error}` : `HTTP ${r.status}`,
        threshold: r.alsoOk.length ? `2xx (or ${r.alsoOk.join("/")})` : "2xx",
        target: r.target,
      });
    }
    // Latency is only meaningful on a response we actually got.
    if (r.error === null && r.ms > maxTtfbMs) {
      breaches.push({ metric: "TTFB", value: secs(r.ms), threshold: `${secs(maxTtfbMs)} max`, target: r.target });
    }
  }

  return { name: "Uptime + latency", status: breaches.length ? "alert" : "pass", detail: details.join(" · "), breaches };
}

// =============================================================================
// Plausible Stats API v2 — one small query helper for checks 3 + 4.
// Returns the first metric of the first result row.
// =============================================================================
function isoHoursAgo(hours: number): [string, string] {
  const now = Date.now();
  return [new Date(now - hours * 3600_000).toISOString(), new Date(now).toISOString()];
}

async function plausibleMetric(metric: string, dateRange: [string, string], filters: unknown[]): Promise<number> {
  const { host, siteId, apiKey, timeoutMs } = CONFIG.plausible;
  const res = await fetchWithTimeout(
    `${host.replace(/\/+$/, "")}/api/v2/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ site_id: siteId, metrics: [metric], date_range: dateRange, filters }),
    },
    timeoutMs,
  );
  if (!res.ok) throw new Error(`Plausible HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as any;
  return Number(json?.results?.[0]?.metrics?.[0] ?? 0);
}

const plausibleConfigured = () => Boolean(CONFIG.plausible.apiKey && CONFIG.plausible.siteId);

const notConfigured = (name: string): CheckResult => ({
  name,
  status: "skipped",
  detail: "skipped — PLAUSIBLE_API_KEY / PLAUSIBLE_SITE_ID not set",
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
  const range = isoHoursAgo(windowHours);
  const target = `${CONFIG.site} ${pages.join(" + ")}`;

  try {
    // Both numerators/denominators are UNIQUE VISITORS, so the ratio is
    // people ÷ people rather than events ÷ people.
    const [visitors, converted] = await Promise.all([
      plausibleMetric("visitors", range, [["is", "event:page", pages]]),
      plausibleMetric("visitors", range, [["is", "event:goal", [goal]]]),
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

    return { name, status: breaches.length ? "alert" : "pass", detail: `${pct(rate)} — ${converted} of ${visitors} visitors in ${windowHours}h`, breaches };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name,
      status: "error",
      detail: `Plausible query failed — ${msg}`,
      breaches: [{ metric: "Funnel check", value: `could not run — ${msg}`, threshold: "Plausible must answer", target }],
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
  const range = isoHoursAgo(windowHours);

  try {
    const [visitors, signups] = await Promise.all([
      plausibleMetric("visitors", range, []),
      plausibleMetric("visitors", range, [["is", "event:goal", [goal]]]),
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

    return { name, status: breaches.length ? "alert" : "pass", detail: `${signups} signups from ${visitors} visitors in ${windowHours}h`, breaches };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name,
      status: "error",
      detail: `Plausible query failed — ${msg}`,
      breaches: [{ metric: "Conversion check", value: `could not run — ${msg}`, threshold: "Plausible must answer", target: CONFIG.site }],
    };
  }
}

// =============================================================================
// 5. CRON HEALTH — did the nightly run, and did it actually deliver?
//    "Ran" is true if the cron logged a run OR nightly stories exist in the
//    window; the second half means this check works on the very first day,
//    before api_events has any history.
// =============================================================================
async function checkCronHealth(db: ReturnType<typeof getDb>): Promise<CheckResult> {
  const name = "Cron health";
  const { route, windowHours } = CONFIG.cron;
  const hours = sql.raw(String(windowHours));

  try {
    const [runsRes, deliveredRes, subsRes] = await Promise.all([
      db.execute(sql`select count(*)::int as n from api_events
                     where route = ${route} and created_at > now() - interval '${hours} hours'`),
      db.execute(sql`select count(*)::int as n from stories
                     where is_nightly = true and created_at > now() - interval '${hours} hours'`),
      db.execute(sql`select count(*)::int as n from subscriptions
                     where status in ('trialing','active')`),
    ]);

    const runs = Number((runsRes.rows?.[0] as any)?.n ?? 0);
    const delivered = Number((deliveredRes.rows?.[0] as any)?.n ?? 0);
    const activeSubs = Number((subsRes.rows?.[0] as any)?.n ?? 0);
    const ran = runs > 0 || delivered > 0;

    const breaches: Breach[] = [];
    if (!ran) {
      breaches.push({
        metric: `Nightly cron run (${windowHours}h)`,
        value: "no run recorded",
        threshold: "1 run per night",
        target: route,
      });
    } else if (delivered === 0 && activeSubs > 0) {
      breaches.push({
        metric: "stories_delivered (last night)",
        value: `0, with ${activeSubs} active subscription${activeSubs === 1 ? "" : "s"}`,
        threshold: `>0 whenever active subscriptions > 0`,
        target: route,
      });
    }

    return {
      name,
      status: breaches.length ? "alert" : "pass",
      detail: `${runs} run${runs === 1 ? "" : "s"} logged, ${delivered} nightly stories delivered, ${activeSubs} active subs`,
      breaches,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name,
      status: "error",
      detail: `query failed — ${msg}`,
      breaches: [{ metric: "Cron health check", value: `could not run — ${msg}`, threshold: "query must succeed", target: route }],
    };
  }
}

// =============================================================================
// 6. ERROR RATE — 402s / 429s / 5xx as a share of story generations, last 24h.
// =============================================================================
async function checkErrorRate(db: ReturnType<typeof getDb>): Promise<CheckResult> {
  const name = "Error rate";
  const { route, windowHours, maxRate, minRequests, errorStatuses, serverErrorFrom } = CONFIG.errorRate;
  const hours = sql.raw(String(windowHours));
  const target = `${CONFIG.site}${route}`;

  // Built from CONFIG, not hardcoded — integers only, so this can't be injected.
  const statusList = sql.raw(errorStatuses.map((n) => String(Math.trunc(n))).join(", "));
  const serverFrom = sql.raw(String(Math.trunc(serverErrorFrom)));

  try {
    const res = await db.execute(sql`
      select count(*)::int as total,
             count(*) filter (where status in (${statusList}) or status >= ${serverFrom})::int as bad
      from api_events
      where route = ${route} and created_at > now() - interval '${hours} hours'`);

    const total = Number((res.rows?.[0] as any)?.total ?? 0);
    const bad = Number((res.rows?.[0] as any)?.bad ?? 0);

    if (total < minRequests) {
      return { name, status: "pass", detail: `${bad}/${total} errors in ${windowHours}h — below the ${minRequests}-request floor`, breaches: [] };
    }

    const rate = bad / total;
    const breaches: Breach[] =
      rate > maxRate
        ? [{
            metric: `${errorStatuses.join("/")}/${serverErrorFrom}+ rate (${windowHours}h)`,
            value: `${pct(rate)} (${bad} of ${total} requests)`,
            threshold: `${pct(maxRate)} max`,
            target,
          }]
        : [];

    return { name, status: breaches.length ? "alert" : "pass", detail: `${pct(rate)} — ${bad} of ${total} requests in ${windowHours}h`, breaches };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name,
      status: "error",
      detail: `query failed — ${msg}`,
      breaches: [{ metric: "Error-rate check", value: `could not run — ${msg}`, threshold: "query must succeed", target }],
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

  const dry = ["1", "true"].includes((new URL(req.url).searchParams.get("dry") || "").toLowerCase());
  const startedAt = Date.now();
  const db = getDb();

  // Every check is independent — run them together and let each own its errors,
  // so one failing check can never hide the other five.
  const checks = await Promise.all([
    checkPageSpeed(db),
    checkUptime(),
    checkFunnel(),
    checkConversionDrought(),
    checkCronHealth(db),
    checkErrorRate(db),
  ]);

  const breaches = checks.flatMap((c) => c.breaches);
  const lines = breaches.map(breachLine);
  const reportLines = checks.map((c) => `[${c.status.toUpperCase()}] ${c.name}: ${c.detail}`);

  // THE RULE: email only on a breach. ?dry=1 always sends, so you can see the
  // report on demand.
  let emailed = false;
  let emailError: string | undefined;
  if (breaches.length > 0 || dry) {
    if (!CONFIG.alertTo) {
      emailError = "no recipient — set HEALTHCHECK_ALERT_TO (or WAITLIST_NOTIFY)";
      console.error(`health-check: ${breaches.length} breach(es) but ${emailError}`);
    } else {
      const subject = breaches.length
        ? `Lullawood alert — ${breaches.length} issue${breaches.length === 1 ? "" : "s"}`
        : "Lullawood health check — all clear";
      // The real alert is breaches only. A ?dry=1 run also carries the full report.
      const res = await sendHealthAlertEmail(CONFIG.alertTo, subject, lines, dry ? reportLines : []);
      emailed = res.success;
      if (!res.success) emailError = res.error;
    }
  }

  const durationMs = Date.now() - startedAt;

  // Log the run itself, so a health check that stops running is itself visible.
  try {
    await db.insert(schema.apiEvents).values({
      route: "/api/cron/health-check",
      status: 200,
      outcome: "cron_run",
      durationMs,
      meta: { breaches: breaches.length, dry, emailed },
    });
  } catch { /* logging must never break the run */ }

  console.log(`health-check: ${breaches.length} breach(es) in ${durationMs}ms${dry ? " (dry)" : ""}${emailed ? " — emailed" : ""}`);

  return NextResponse.json({
    ok: true,
    dry,
    durationMs,
    breachCount: breaches.length,
    emailed,
    ...(emailError ? { emailError } : {}),
    breaches: lines,
    checks: checks.map(({ name, status, detail }) => ({ name, status, detail })),
  });
}
