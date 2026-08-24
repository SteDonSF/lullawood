import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  const db = getDb();
  try {
    const [waitTotal, waitBySource, waitRecent, waitDaily, demoTotal, demoDaily, demoPicks, speedRuns, speedLatest] = await Promise.all([
      db.execute(sql`select count(*)::int as n from waitlist`),
      db.execute(sql`select coalesce(nullif(source,''),'unknown') as source, count(*)::int as n from waitlist group by 1 order by n desc`),
      db.execute(sql`select email, source, created_at from waitlist order by created_at desc limit 25`),
      db.execute(sql`select to_char(date_trunc('day', created_at),'Mon DD') as day, count(*)::int as n from waitlist where created_at > now() - interval '30 days' group by date_trunc('day', created_at) order by date_trunc('day', created_at)`),
      db.execute(sql`select count(*)::int as n from demo_events where ok = true`),
      db.execute(sql`select to_char(date_trunc('day', created_at),'Mon DD') as day, count(*)::int as n from demo_events where created_at > now() - interval '30 days' group by date_trunc('day', created_at) order by date_trunc('day', created_at)`),
      db.execute(sql`select 'animal' as kind, coalesce(nullif(animal,''),'—') as val, count(*)::int as n from demo_events where ok=true group by 2 union all select 'adventure', coalesce(nullif(adventure,''),'—'), count(*)::int from demo_events where ok=true group by 2 union all select 'color', coalesce(nullif(color,''),'—'), count(*)::int from demo_events where ok=true group by 2 order by 1, n desc`),
      // Product health — the last 7 days of PageSpeed runs written by the daily
      // health check (/api/cron/health-check). Newest first; one row per page
      // per run. Empty until that cron has run at least once.
      db.execute(sql`select path, strategy, performance_score, lcp_ms, tbt_ms, ttfb_ms, created_at
                     from page_speed
                     where created_at > now() - interval '7 days'
                     order by created_at desc, path`),
      // The most recent run per page, so the dashboard can lead with "where we
      // stand today" before showing the trend behind it.
      db.execute(sql`select distinct on (path) path, performance_score, lcp_ms, tbt_ms, ttfb_ms, created_at
                     from page_speed
                     where created_at > now() - interval '7 days'
                     order by path, created_at desc`),
    ]);
    return NextResponse.json({
      waitlist: {
        total: (waitTotal.rows?.[0] as any)?.n ?? 0,
        bySource: waitBySource.rows ?? [],
        recent: waitRecent.rows ?? [],
        daily: waitDaily.rows ?? [],
      },
      demo: {
        total: (demoTotal.rows?.[0] as any)?.n ?? 0,
        daily: demoDaily.rows ?? [],
        picks: demoPicks.rows ?? [],
      },
      pageSpeed: {
        latest: speedLatest.rows ?? [],
        runs: speedRuns.rows ?? [],
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "metrics_failed" }, { status: 500 });
  }
}
