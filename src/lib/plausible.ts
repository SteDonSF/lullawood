// =============================================================================
// plausible.ts — Stats API client (SERVER ONLY).
// -----------------------------------------------------------------------------
// The API key is a Cloudflare secret and must never reach the browser. Nothing
// in this file may be imported from a client component: it is used only by
// /api/admin/metrics and the weekly-digest cron route, both of which run on the
// edge runtime behind the Access wall.
//
// Uses Stats API v2 (POST /api/v2/query).
// =============================================================================
import type { FunnelEvent } from "./analytics";

const API = "https://plausible.io/api/v2/query";

const SITE_ID = process.env.PLAUSIBLE_SITE_ID ?? "lullawood.com";

/** The funnel, in order. Order matters — conversion is computed step to step. */
export const FUNNEL_STEPS: FunnelEvent[] = [
  "demo_started",
  "demo_completed",
  "signup_started",
  "signup_completed",
  "child_added",
  "checkout_started",
  "subscription_active",
];

export type FunnelStep = {
  event: FunnelEvent;
  count: number;
  /** Conversion from the PREVIOUS step. null on the first step. */
  fromPrev: number | null;
  /** Conversion from the very first step. null on the first step. */
  fromTop: number | null;
  /** How many bodies were lost between the previous step and this one. */
  droppedFromPrev: number | null;
};

export type FunnelResult = {
  ok: boolean;
  /** Present when ok === false — shown in the UI instead of silently zeroing. */
  error?: string;
  period: string;
  steps: FunnelStep[];
};

/**
 * Pull one period's funnel. Never throws: a missing key or a Plausible outage
 * comes back as { ok:false, error } so the dashboard can say so plainly rather
 * than render seven zeros that look like a product collapse.
 */
export async function fetchFunnel(period: "7d" | "30d" | "90d"): Promise<FunnelResult> {
  const key = process.env.PLAUSIBLE_API_KEY;
  const empty = FUNNEL_STEPS.map((event) => ({
    event,
    count: 0,
    fromPrev: null,
    fromTop: null,
    droppedFromPrev: null,
  }));

  if (!key) {
    return { ok: false, error: "PLAUSIBLE_API_KEY is not set", period, steps: empty };
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        site_id: SITE_ID,
        metrics: ["events"],
        date_range: period,
        dimensions: ["event:name"],
        filters: [["is", "event:name", FUNNEL_STEPS]],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Plausible ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        period,
        steps: empty,
      };
    }

    const body = (await res.json()) as {
      results?: { metrics: number[]; dimensions: string[] }[];
    };

    const counts = new Map<string, number>();
    for (const row of body.results ?? []) {
      counts.set(row.dimensions?.[0] ?? "", row.metrics?.[0] ?? 0);
    }

    const top = counts.get(FUNNEL_STEPS[0]) ?? 0;
    const steps: FunnelStep[] = FUNNEL_STEPS.map((event, i) => {
      const count = counts.get(event) ?? 0;
      const prev = i === 0 ? null : counts.get(FUNNEL_STEPS[i - 1]) ?? 0;
      return {
        event,
        count,
        fromPrev: prev === null ? null : prev > 0 ? (count / prev) * 100 : 0,
        fromTop: i === 0 ? null : top > 0 ? (count / top) * 100 : 0,
        droppedFromPrev: prev === null ? null : Math.max(0, prev - count),
      };
    });

    return { ok: true, period, steps };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Plausible request failed",
      period,
      steps: empty,
    };
  }
}

// =============================================================================
// Rolling-window queries for the daily health check.
// -----------------------------------------------------------------------------
// fetchFunnel above answers "how did the funnel convert over 7/30/90 days" with
// EVENT counts. The health check needs something different: unique VISITORS in
// an exact rolling window (last 24h, last 48h), because a rate of people over
// people is the only one that means anything, and "yesterday" has to mean the
// last 24 hours, not "since midnight UTC".
//
// Stats API v2 takes an explicit [start, end] ISO-8601 pair for date_range,
// which is what makes the rolling window possible.
// =============================================================================

/** Whether the Stats API is usable at all. Checks 3 + 4 skip when it isn't. */
export function plausibleConfigured(): boolean {
  return Boolean(process.env.PLAUSIBLE_API_KEY);
}

/** [start, end] for the last N hours, as the API wants it. */
export function lastHours(hours: number): [string, string] {
  const now = Date.now();
  return [new Date(now - hours * 3_600_000).toISOString(), new Date(now).toISOString()];
}

/**
 * Unique visitors in a rolling window, optionally narrowed to a set of pages or
 * to the visitors who fired one goal.
 *
 * THROWS on a missing key or a Plausible error — unlike fetchFunnel, whose
 * caller is a dashboard that must still render. The health check's caller wants
 * the failure: a check that cannot run is itself worth reporting, and silently
 * returning 0 here would read as "nobody visited" and fire a false alert.
 */
export async function fetchVisitors(
  range: [string, string],
  opts: { pages?: string[]; goal?: FunnelEvent } = {}
): Promise<number> {
  const key = process.env.PLAUSIBLE_API_KEY;
  if (!key) throw new Error("PLAUSIBLE_API_KEY is not set");

  const filters: unknown[] = [];
  if (opts.pages?.length) filters.push(["is", "event:page", opts.pages]);
  if (opts.goal) filters.push(["is", "event:name", [opts.goal]]);

  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ site_id: SITE_ID, metrics: ["visitors"], date_range: range, filters }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Plausible ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const body = (await res.json()) as { results?: { metrics: number[] }[] };
  // No rows at all is a legitimate zero — nobody matched the filter.
  return body.results?.[0]?.metrics?.[0] ?? 0;
}
