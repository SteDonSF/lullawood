// =============================================================================
// metrics.ts — every number the admin dashboard and the Monday digest report.
// -----------------------------------------------------------------------------
// SERVER ONLY. Shared by /api/admin/metrics (behind Cloudflare Access) and
// /api/cron/weekly-digest (behind CRON_SECRET) so the dashboard and the email
// can never drift apart — one definition of "active", one of "trial", one of
// "retained".
//
// A NOTE ON THE 7-DAY AVERAGES, because it changes how you should read them:
//   We keep no daily snapshot table. Stock metrics (active subs, MRR, trials,
//   dunning) are therefore RECONSTRUCTED as-of each of the last 7 days from the
//   timestamps we do have — created_at, trial_end, current_period_end. That is
//   accurate for subscriptions that ran their normal course and approximate for
//   ones that changed plan or were refunded mid-period, because we store only
//   the CURRENT status, not its history. Flow metrics (stories delivered) are
//   exact. The dashboard labels the column accordingly; don't quote the
//   reconstructed averages to an investor without saying so.
// =============================================================================
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

type Row = Record<string, unknown>;
const rows = (r: { rows?: Row[] }): Row[] => r.rows ?? [];
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v) || 0);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

// --- money -------------------------------------------------------------------
// Display prices, mirrored from the pricing page. Stripe remains the source of
// truth for what is actually charged; these exist only to turn a subscription
// count into an MRR figure. Yearly plans are divided down to a monthly figure.
export type PlanName = "dreamer" | "family" | "unknown";
export type Cadence = "monthly" | "annual" | "unknown";
export type PriceMeta = { plan: PlanName; cadence: Cadence; monthlyCents: number };

// An unrecognised price ID resolves to 'unknown' with zero MRR rather than
// being silently bucketed into a real plan. The dashboard counts these and says
// so, because a legacy or test price quietly dropping out of MRR is exactly the
// kind of thing that makes a revenue number wrong in a way nobody notices.
function priceMeta(priceId: string): PriceMeta {
  const env = process.env;
  switch (priceId) {
    case env.STRIPE_PRICE_DREAMER_MONTHLY: return { plan: "dreamer", cadence: "monthly", monthlyCents: 899 };
    case env.STRIPE_PRICE_DREAMER_YEARLY:  return { plan: "dreamer", cadence: "annual",  monthlyCents: Math.round(8999 / 12) };
    case env.STRIPE_PRICE_FAMILY_MONTHLY:  return { plan: "family",  cadence: "monthly", monthlyCents: 1299 };
    case env.STRIPE_PRICE_FAMILY_YEARLY:   return { plan: "family",  cadence: "annual",  monthlyCents: Math.round(12999 / 12) };
    default: return { plan: "unknown", cadence: "unknown", monthlyCents: 0 };
  }
}

function monthlyCentsForPriceId(priceId: string): number {
  return priceMeta(priceId).monthlyCents;
}

export type HealthMetric = { today: number; avg7: number };
export type Health = {
  activeSubscriptions: HealthMetric;
  mrrCents: HealthMetric;
  trialsInFlight: HealthMetric;
  storiesLastNight: HealthMetric;
  failedPayments: HealthMetric;
  /**
   * Where the 7-day averages came from.
   *  'measured'      — a full week of metrics_daily snapshots. Trustworthy.
   *  'reconstructed' — inferred from subscription timestamps, because there
   *                    aren't 7 snapshots yet. Close, not exact.
   */
  avg7Basis: "measured" | "reconstructed";
  /** How many daily snapshots exist in the trailing week (0-7). */
  snapshotDays: number;
};

// A subscription counted as PAYING as of day d: it existed, its paid period
// covered d, it was past any trial, and it never failed to start.
const PAYING_ASOF = sql`
  s.created_at < days.d + interval '1 day'
  and (s.current_period_end is null or s.current_period_end >= days.d)
  and (s.trial_end is null or s.trial_end < days.d)
  and s.status not in ('incomplete','incomplete_expired')
  and not (s.status = 'canceled' and s.current_period_end is null)
`;

export async function getHealth(): Promise<Health> {
  const db = getDb();

  const [asof, mrr, stories] = await Promise.all([
    // Stock metrics, reconstructed for each of the last 7 days.
    db.execute(sql`
      with days as (
        select generate_series(
          date_trunc('day', now()) - interval '6 days',
          date_trunc('day', now()),
          interval '1 day'
        )::date as d
      )
      select
        days.d::text as day,
        count(s.id) filter (where ${PAYING_ASOF})::int as paying,
        count(s.id) filter (
          where s.created_at < days.d + interval '1 day'
            and s.trial_end is not null and s.trial_end >= days.d
        )::int as trialing,
        count(s.id) filter (
          where s.status in ('past_due','unpaid')
            and s.created_at < days.d + interval '1 day'
            and (s.current_period_end is null or s.current_period_end >= days.d)
        )::int as dunning
      from days left join subscriptions s on true
      group by 1 order by 1
    `),
    // Same as-of window, split by price so MRR can be summed in JS (the price
    // IDs live in env vars, so SQL can't do the lookup).
    db.execute(sql`
      with days as (
        select generate_series(
          date_trunc('day', now()) - interval '6 days',
          date_trunc('day', now()),
          interval '1 day'
        )::date as d
      )
      select days.d::text as day, coalesce(s.stripe_price_id,'') as price_id, count(*)::int as n
      from days join subscriptions s on ${PAYING_ASOF}
      group by 1,2
    `),
    // Flow metric — exact, straight from the delivery timestamps.
    db.execute(sql`
      select
        count(*) filter (where created_at >= now() - interval '24 hours')::int as last24,
        (count(*) filter (where created_at >= now() - interval '7 days')::numeric / 7.0) as avg7
      from stories where is_nightly = true
    `),
  ]);

  const days = rows(asof);
  const last = days[days.length - 1] ?? {};
  const avgOf = (k: string) =>
    days.length ? days.reduce((a, r) => a + num(r[k]), 0) / days.length : 0;

  // MRR per day, then today's value and the 7-day mean.
  const mrrByDay = new Map<string, number>();
  for (const r of rows(mrr)) {
    const day = str(r.day);
    mrrByDay.set(day, (mrrByDay.get(day) ?? 0) + monthlyCentsForPriceId(str(r.price_id)) * num(r.n));
  }
  const dayKeys = days.map((r) => str(r.day));
  const mrrToday = mrrByDay.get(dayKeys[dayKeys.length - 1] ?? "") ?? 0;
  const mrrAvg = dayKeys.length
    ? dayKeys.reduce((a, d) => a + (mrrByDay.get(d) ?? 0), 0) / dayKeys.length
    : 0;

  const st = rows(stories)[0] ?? {};

  // Today's figures are always live. The AVERAGES prefer real snapshots and
  // fall back to reconstruction only until a full week has accumulated.
  const today = {
    activeSubscriptions: num(last.paying),
    mrrCents: mrrToday,
    trialsInFlight: num(last.trialing),
    storiesLastNight: num(st.last24),
    failedPayments: num(last.dunning),
  };

  const snaps = rows(
    await db.execute(sql`
      select active_subscriptions, mrr_cents, trials_in_flight,
             stories_delivered, failed_payments
      from metrics_daily
      where day >= to_char(now() - interval '7 days', 'YYYY-MM-DD')
      order by day desc
      limit 7
    `)
  );

  const measured = snaps.length >= 7;
  const snapAvg = (k: string) =>
    snaps.length ? snaps.reduce((a, r) => a + num(r[k]), 0) / snaps.length : 0;

  return {
    activeSubscriptions: { today: today.activeSubscriptions, avg7: measured ? snapAvg("active_subscriptions") : avgOf("paying") },
    mrrCents: { today: today.mrrCents, avg7: measured ? snapAvg("mrr_cents") : mrrAvg },
    trialsInFlight: { today: today.trialsInFlight, avg7: measured ? snapAvg("trials_in_flight") : avgOf("trialing") },
    storiesLastNight: { today: today.storiesLastNight, avg7: measured ? snapAvg("stories_delivered") : num(st.avg7) },
    failedPayments: { today: today.failedPayments, avg7: measured ? snapAvg("failed_payments") : avgOf("dunning") },
    avg7Basis: measured ? "measured" : "reconstructed",
    snapshotDays: snaps.length,
  };
}

/**
 * Write today's five health numbers into metrics_daily. Called once a day by
 * the trial-reminder cron. Idempotent: keyed on the day, so re-running (or the
 * cron firing twice) overwrites rather than double-counting.
 *
 * Best-effort by contract — returns false on failure and never throws, because
 * a missed snapshot must never stop the trial-reminder emails that share the
 * same cron run.
 */
export async function snapshotDailyMetrics(): Promise<boolean> {
  try {
    const h = await getHealth();
    const db = getDb();
    await db.execute(sql`
      insert into metrics_daily
        (day, active_subscriptions, mrr_cents, trials_in_flight, stories_delivered, failed_payments)
      values (
        to_char(now(), 'YYYY-MM-DD'),
        ${h.activeSubscriptions.today},
        ${h.mrrCents.today},
        ${h.trialsInFlight.today},
        ${h.storiesLastNight.today},
        ${h.failedPayments.today}
      )
      on conflict (day) do update set
        active_subscriptions = excluded.active_subscriptions,
        mrr_cents            = excluded.mrr_cents,
        trials_in_flight     = excluded.trials_in_flight,
        stories_delivered    = excluded.stories_delivered,
        failed_payments      = excluded.failed_payments
    `);
    return true;
  } catch {
    return false;
  }
}

// --- channel -----------------------------------------------------------------

export type ChannelRow = {
  source: string;
  signups: number;
  trials: number;
  paying: number;
  trialToPaidPct: number | null;
  spendCents: number;
  cacCents: number | null;
  month3Eligible: number;
  month3Retained: number;
  month3Pct: number | null;
};

/**
 * The table this dashboard exists for. Lifetime figures throughout — lifetime
 * signups against lifetime spend — so CAC is coherent. A per-period CAC would
 * need spend and signups windowed to the same dates; that's a later refinement.
 */
export async function getChannels(): Promise<ChannelRow[]> {
  const db = getDb();
  const [funnel, spend] = await Promise.all([
    db.execute(sql`
      select
        coalesce(nullif(u.signup_source,''), 'unattributed') as source,
        count(*)::int as signups,
        count(*) filter (where s.trial_end is not null)::int as trials,
        count(*) filter (where s.status = 'active')::int as paying,
        count(*) filter (where u."createdAt" < now() - interval '3 months')::int as m3_eligible,
        count(*) filter (
          where u."createdAt" < now() - interval '3 months'
            and (
              s.status in ('active','trialing')
              or s.current_period_end >= u."createdAt" + interval '3 months'
            )
        )::int as m3_retained
      from "user" u
      left join subscriptions s on s.user_id = u.id
      group by 1
      order by signups desc
    `),
    db.execute(sql`
      select source, coalesce(sum(amount_cents),0)::int as cents
      from channel_spend group by 1
    `),
  ]);

  const spendBySource = new Map<string, number>();
  for (const r of rows(spend)) spendBySource.set(str(r.source), num(r.cents));

  return rows(funnel).map((r) => {
    const source = str(r.source);
    const trials = num(r.trials);
    const paying = num(r.paying);
    const spendCents = spendBySource.get(source) ?? 0;
    const m3e = num(r.m3_eligible);
    const m3r = num(r.m3_retained);
    return {
      source,
      signups: num(r.signups),
      trials,
      paying,
      trialToPaidPct: trials > 0 ? (paying / trials) * 100 : null,
      spendCents,
      // CAC is meaningless with no paying customers — null, not Infinity.
      cacCents: paying > 0 && spendCents > 0 ? Math.round(spendCents / paying) : null,
      month3Eligible: m3e,
      month3Retained: m3r,
      month3Pct: m3e > 0 ? (m3r / m3e) * 100 : null,
    };
  });
}

// --- cohort retention --------------------------------------------------------

export type CohortRow = {
  cohort: string;      // 'YYYY-MM'
  size: number;
  /** index 0 = month 1 … index 5 = month 6. null = cohort too young to judge. */
  months: (number | null)[];
};

export async function getCohorts(): Promise<CohortRow[]> {
  const db = getDb();
  // One column pair per month 1-6: how many were old enough to be judged, and
  // how many of those were still covered at that point.
  const monthCols = [1, 2, 3, 4, 5, 6]
    .map(
      (m) => `
      count(*) filter (where now() >= signed + interval '${m} months')::int as e${m},
      count(*) filter (
        where now() >= signed + interval '${m} months'
          and (status in ('active','trialing') or current_period_end >= signed + interval '${m} months')
      )::int as r${m}`
    )
    .join(",");

  const res = await db.execute(
    sql.raw(`
      with c as (
        select u.id,
               date_trunc('month', u."createdAt") as cohort,
               u."createdAt" as signed,
               s.status, s.current_period_end
        from "user" u left join subscriptions s on s.user_id = u.id
      )
      select to_char(cohort, 'YYYY-MM') as cohort, count(*)::int as size, ${monthCols}
      from c group by cohort order by cohort desc limit 12
    `)
  );

  return rows(res).map((r) => ({
    cohort: str(r.cohort),
    size: num(r.size),
    months: [1, 2, 3, 4, 5, 6].map((m) => {
      const eligible = num(r[`e${m}`]);
      if (eligible === 0) return null; // cohort hasn't reached this month yet
      return (num(r[`r${m}`]) / eligible) * 100;
    }),
  }));
}

// --- product health ----------------------------------------------------------

export type ProductHealth = {
  storiesPerChildPerWeek: number | null;
  activeChildren: number;
  stories7d: number;
  failures24h: number;
  paywalled402s24h: number;
  rateLimited429s24h: number;
  medianLatencyMs: number | null;
  demoFailures24h: number;
  /** False until api_events has data — the panel says so rather than showing 0s. */
  hasApiEventData: boolean;
};

export async function getProductHealth(): Promise<ProductHealth> {
  const db = getDb();
  const [usage, api, demo] = await Promise.all([
    db.execute(sql`
      select
        (select count(*) from stories where created_at >= now() - interval '7 days')::int as stories7,
        (select count(*)
           from children c
           join subscriptions s on s.user_id = c.parent_id
          where c.active and s.status in ('active','trialing'))::int as active_children
    `),
    db.execute(sql`
      select
        count(*)::int as total,
        count(*) filter (where status >= 500)::int as failures,
        count(*) filter (where status = 402)::int as paywalled,
        count(*) filter (where status = 429)::int as ratelimited,
        percentile_cont(0.5) within group (order by duration_ms)
          filter (where duration_ms is not null) as median_ms
      from api_events
      where created_at >= now() - interval '24 hours'
        and route = 'generate-story'
    `),
    db.execute(sql`
      select count(*)::int as n from demo_events
      where ok = false and created_at >= now() - interval '24 hours'
    `),
  ]);

  const u = rows(usage)[0] ?? {};
  const a = rows(api)[0] ?? {};
  const activeChildren = num(u.active_children);
  const stories7 = num(u.stories7);

  return {
    activeChildren,
    stories7d: stories7,
    storiesPerChildPerWeek: activeChildren > 0 ? stories7 / activeChildren : null,
    failures24h: num(a.failures),
    paywalled402s24h: num(a.paywalled),
    rateLimited429s24h: num(a.ratelimited),
    medianLatencyMs: a.median_ms === null || a.median_ms === undefined ? null : Math.round(num(a.median_ms)),
    demoFailures24h: num(rows(demo)[0]?.n),
    hasApiEventData: num(a.total) > 0,
  };
}

// --- weekly digest numbers ---------------------------------------------------

export type WeekSummary = {
  demos: number;
  signups: number;
  trials: number;
  actives: number;
  churn: number;
};

/** The five lines of the Monday email. Week = the trailing 7 days. */
export async function getWeekSummary(): Promise<WeekSummary> {
  const db = getDb();
  const res = await db.execute(sql`
    select
      (select count(*) from demo_events where created_at >= now() - interval '7 days')::int as demos,
      (select count(*) from "user" where "createdAt" >= now() - interval '7 days')::int as signups,
      (select count(*) from subscriptions
         where trial_end is not null and created_at >= now() - interval '7 days')::int as trials,
      (select count(*) from subscriptions where status = 'active')::int as actives,
      -- Churn: subscriptions whose paid period ended in the last 7 days and
      -- that are not currently active or trialing.
      (select count(*) from subscriptions
         where status not in ('active','trialing')
           and current_period_end >= now() - interval '7 days'
           and current_period_end < now())::int as churn
  `);
  const r = rows(res)[0] ?? {};
  return {
    demos: num(r.demos),
    signups: num(r.signups),
    trials: num(r.trials),
    actives: num(r.actives),
    churn: num(r.churn),
  };
}

// --- helpers shared with the email -------------------------------------------

export function usd(cents: number): string {
  // Sign goes OUTSIDE the dollar sign: -$5.06, not $-5.06. A negative net is
  // exactly the number you least want to misread at a glance.
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(v: number | null, digits = 1): string {
  return v === null ? "—" : `${v.toFixed(digits)}%`;
}

// --- revenue -----------------------------------------------------------------

export type RevenueSlice = { label: string; subs: number; mrrCents: number; sharePct: number | null };
export type TrialConversion = {
  window: "30d" | "90d";
  /** Trials STARTED in the window whose trial period has since ended. */
  matured: number;
  converted: number;
  pct: number | null;
};
export type Revenue = {
  mrrCents: number;
  activeSubscriptions: number;
  arpuCents: number | null;
  byPlan: RevenueSlice[];
  byCadence: RevenueSlice[];
  /** Annual share of MRR and of subscription count. */
  annualMrrSharePct: number | null;
  annualSubSharePct: number | null;

  /** Net collected (charges minus refunds), from Stripe. Null when unavailable. */
  totalCollectedCents: number | null;
  totalCollectedTruncated: boolean;
  totalCollectedError: string | null;
  totalCollectedCharges: number;

  trialConversion: TrialConversion[];

  churnedMrr30dCents: number;
  churnedCount30d: number;
  /**
   * False when NO subscription has yet reached the end of a billing period —
   * in which case zero churn is an absence of history, not a good result.
   */
  churnObservable: boolean;

  /** Subs on a price ID we can't map. Excluded from MRR; surfaced as a caveat. */
  unknownPriceSubs: number;
};

/**
 * Net cash collected to date, straight from Stripe — our tables record
 * subscription STATE, never payments, so this cannot come from Postgres.
 *
 * Paginates with a hard cap so a growing account can't turn the admin
 * dashboard into a minute-long request. If the cap is hit the caller is told,
 * and the page says "at least $X" rather than presenting a partial sum as
 * final. Any failure returns null so the UI can name the problem instead of
 * rendering $0.00.
 */
async function fetchTotalCollected(sinceUnix?: number): Promise<{
  cents: number | null; truncated: boolean; error: string | null; charges: number;
}> {
  const MAX_PAGES = 20; // 2,000 charges
  try {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    let cents = 0;
    let charges = 0;
    let startingAfter: string | undefined;
    let truncated = false;

    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) { truncated = true; break; }
      const res = await stripe.charges.list({
        limit: 100,
        ...(sinceUnix ? { created: { gte: sinceUnix } } : {}),
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const c of res.data) {
        if (c.status !== "succeeded") continue;
        // Net of refunds — "collected" should not flatter itself.
        cents += (c.amount ?? 0) - (c.amount_refunded ?? 0);
        charges += 1;
      }
      if (!res.has_more || res.data.length === 0) break;
      startingAfter = res.data[res.data.length - 1]?.id;
      if (!startingAfter) break;
    }
    return { cents, truncated, error: null, charges };
  } catch (e) {
    return {
      cents: null,
      truncated: false,
      error: e instanceof Error ? e.message : "Stripe request failed",
      charges: 0,
    };
  }
}

export async function getRevenue(): Promise<Revenue> {
  const db = getDb();

  const [live, trials, churn, collected] = await Promise.all([
    // Currently-paying subscriptions, by price.
    db.execute(sql`
      select coalesce(stripe_price_id,'') as price_id, count(*)::int as n
      from subscriptions
      where status = 'active'
      group by 1
    `),
    // Trial cohorts by window. Only trials that have actually FINISHED count in
    // the denominator — a trial still running is neither converted nor lost,
    // and including it would drag the rate down for no reason.
    db.execute(sql`
      select
        count(*) filter (where created_at >= now() - interval '30 days' and trial_end < now())::int as matured30,
        count(*) filter (where created_at >= now() - interval '30 days' and trial_end < now() and status = 'active')::int as converted30,
        count(*) filter (where created_at >= now() - interval '90 days' and trial_end < now())::int as matured90,
        count(*) filter (where created_at >= now() - interval '90 days' and trial_end < now() and status = 'active')::int as converted90
      from subscriptions
      where trial_end is not null
    `),
    // Churn: periods that ENDED in the last 30 days without renewing. We store
    // no canceled_at, so the end of the paid period is the churn moment — which
    // is also the moment the revenue actually stops.
    db.execute(sql`
      select
        coalesce(stripe_price_id,'') as price_id,
        count(*)::int as n,
        (select count(*) from subscriptions where current_period_end < now())::int as ever_ended
      from subscriptions
      where status not in ('active','trialing')
        and current_period_end >= now() - interval '30 days'
        and current_period_end < now()
      group by 1
    `),
    fetchTotalCollected(),
  ]);

  // --- MRR, sliced ---
  let mrrCents = 0;
  let activeSubscriptions = 0;
  let unknownPriceSubs = 0;
  const planAgg = new Map<PlanName, { subs: number; mrrCents: number }>();
  const cadenceAgg = new Map<Cadence, { subs: number; mrrCents: number }>();

  for (const r of rows(live)) {
    const n = num(r.n);
    const meta = priceMeta(str(r.price_id));
    const cents = meta.monthlyCents * n;
    mrrCents += cents;
    activeSubscriptions += n;
    if (meta.plan === "unknown") unknownPriceSubs += n;

    const p = planAgg.get(meta.plan) ?? { subs: 0, mrrCents: 0 };
    planAgg.set(meta.plan, { subs: p.subs + n, mrrCents: p.mrrCents + cents });
    const c = cadenceAgg.get(meta.cadence) ?? { subs: 0, mrrCents: 0 };
    cadenceAgg.set(meta.cadence, { subs: c.subs + n, mrrCents: c.mrrCents + cents });
  }

  const slice = (label: string, v: { subs: number; mrrCents: number }): RevenueSlice => ({
    label,
    subs: v.subs,
    mrrCents: v.mrrCents,
    sharePct: mrrCents > 0 ? (v.mrrCents / mrrCents) * 100 : null,
  });

  const byPlan: RevenueSlice[] = (["dreamer", "family", "unknown"] as PlanName[])
    .filter((p) => planAgg.has(p))
    .map((p) => slice(p, planAgg.get(p)!));
  const byCadence: RevenueSlice[] = (["monthly", "annual", "unknown"] as Cadence[])
    .filter((c) => cadenceAgg.has(c))
    .map((c) => slice(c, cadenceAgg.get(c)!));

  const annual = cadenceAgg.get("annual") ?? { subs: 0, mrrCents: 0 };

  // --- trial conversion ---
  const t = rows(trials)[0] ?? {};
  const conv = (w: "30d" | "90d", matured: number, converted: number): TrialConversion => ({
    window: w, matured, converted, pct: matured > 0 ? (converted / matured) * 100 : null,
  });

  // --- churned MRR ---
  let churnedMrr30dCents = 0;
  let churnedCount30d = 0;
  let churnObservable = false;
  for (const r of rows(churn)) {
    churnObservable = churnObservable || num(r.ever_ended) > 0;
    const n = num(r.n);
    churnedCount30d += n;
    churnedMrr30dCents += priceMeta(str(r.price_id)).monthlyCents * n;
  }
  if (rows(churn).length === 0) {
    // No churn rows at all — ask separately whether ANY period has ever ended,
    // so we can tell "nobody churned" apart from "nothing has run long enough".
    const probe = rows(await db.execute(sql`
      select (select count(*) from subscriptions where current_period_end < now())::int as ever_ended
    `))[0] ?? {};
    churnObservable = num(probe.ever_ended) > 0;
  }

  return {
    mrrCents,
    activeSubscriptions,
    arpuCents: activeSubscriptions > 0 ? Math.round(mrrCents / activeSubscriptions) : null,
    byPlan,
    byCadence,
    annualMrrSharePct: mrrCents > 0 ? (annual.mrrCents / mrrCents) * 100 : null,
    annualSubSharePct: activeSubscriptions > 0 ? (annual.subs / activeSubscriptions) * 100 : null,
    totalCollectedCents: collected.cents,
    totalCollectedTruncated: collected.truncated,
    totalCollectedError: collected.error,
    totalCollectedCharges: collected.charges,
    trialConversion: [
      conv("30d", num(t.matured30), num(t.converted30)),
      conv("90d", num(t.matured90), num(t.converted90)),
    ],
    churnedMrr30dCents,
    churnedCount30d,
    churnObservable,
    unknownPriceSubs,
  };
}

// --- weekly money block ------------------------------------------------------

export type WeekMoney = {
  mrrCents: number;

  /** Net cash collected in the trailing 7 days. Null when Stripe is unreachable. */
  collectedCents: number | null;
  collectedError: string | null;
  collectedTruncated: boolean;

  /**
   * Advertising spend attributed to the trailing 7 days, pro-rated day by day
   * from the manually-entered MONTHLY figures. An estimate, never a charge.
   * Null when no channel_spend row covers any day in the window.
   */
  adSpendCents: number | null;
  /** Which 'YYYY-MM' rows contributed — named in the email when spend is missing. */
  adSpendMonths: string[];

  /** collected − adSpend. Null when revenue is unknown. ADVERTISING ONLY. */
  netCents: number | null;

  churnedMrrCents: number;
  /** False when no billing period has ended yet — zero churn would be an absence of data. */
  churnObservable: boolean;
};

/**
 * The money block at the top of the Monday digest.
 *
 * Pro-rating: ad spend is entered per calendar month, but the digest window is
 * a trailing 7 days that can straddle two months. So we take each day in the
 * window, charge it that month's daily rate (monthly amount ÷ days in that
 * month), and sum. A 7-day window in a 31-day month bills 7/31 of the month.
 */
export async function getWeekMoney(): Promise<WeekMoney> {
  const db = getDb();
  const sinceUnix = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const [live, spend, churn, collected] = await Promise.all([
    db.execute(sql`
      select coalesce(stripe_price_id,'') as price_id, count(*)::int as n
      from subscriptions where status = 'active' group by 1
    `),
    db.execute(sql`
      with days as (
        select generate_series(now()::date - 6, now()::date, interval '1 day')::date as d
      )
      select
        coalesce(sum(
          cs.amount_cents::numeric
          / extract(day from (date_trunc('month', days.d) + interval '1 month' - interval '1 day'))
        ), 0)::bigint as cents,
        coalesce(array_agg(distinct cs.month) filter (where cs.month is not null), '{}') as months,
        count(cs.id)::int as matched
      from days
      left join channel_spend cs on cs.month = to_char(days.d, 'YYYY-MM')
    `),
    db.execute(sql`
      select
        coalesce(stripe_price_id,'') as price_id,
        count(*)::int as n,
        (select count(*) from subscriptions where current_period_end < now())::int as ever_ended
      from subscriptions
      where status not in ('active','trialing')
        and current_period_end >= now() - interval '7 days'
        and current_period_end < now()
      group by 1
    `),
    fetchTotalCollected(sinceUnix),
  ]);

  let mrrCents = 0;
  for (const r of rows(live)) mrrCents += monthlyCentsForPriceId(str(r.price_id)) * num(r.n);

  const sp = rows(spend)[0] ?? {};
  const matched = num(sp.matched);
  const adSpendCents = matched > 0 ? Math.round(num(sp.cents)) : null;
  const adSpendMonths = Array.isArray(sp.months)
    ? (sp.months as unknown[]).filter((x) => x !== null && x !== undefined).map(String)
    : [];

  let churnedMrrCents = 0;
  let churnObservable = false;
  for (const r of rows(churn)) {
    churnObservable = churnObservable || num(r.ever_ended) > 0;
    churnedMrrCents += monthlyCentsForPriceId(str(r.price_id)) * num(r.n);
  }
  if (rows(churn).length === 0) {
    const probe = rows(await db.execute(sql`
      select (select count(*) from subscriptions where current_period_end < now())::int as ever_ended
    `))[0] ?? {};
    churnObservable = num(probe.ever_ended) > 0;
  }

  return {
    mrrCents,
    collectedCents: collected.cents,
    collectedError: collected.error,
    collectedTruncated: collected.truncated,
    adSpendCents,
    adSpendMonths,
    // Unknown revenue makes net unknowable. Unrecorded spend does not — it just
    // means nothing was subtracted, which the email states outright.
    netCents: collected.cents === null ? null : collected.cents - (adSpendCents ?? 0),
    churnedMrrCents,
    churnObservable,
  };
}
