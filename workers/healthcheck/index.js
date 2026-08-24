// =============================================================================
// Lullawood daily health-check cron Worker.
// -----------------------------------------------------------------------------
// WHY: Cloudflare Pages Functions can't own a Cron Trigger — only Workers can.
//   So this tiny Worker runs on a schedule and fetch()es the secret-gated Pages
//   route (/api/cron/health-check), which runs the six checks (page speed,
//   uptime/latency, funnel rate, conversion drought, cron health, error rate)
//   and emails ONE alert listing every breach.
// SILENCE IS THE POINT: the route emails only when something breached a
//   threshold. No email means everything passed.
// AUTH: sends  Authorization: Bearer <CRON_SECRET>. CRON_SECRET must match the
//   value set on the Pages project. Set it here with `wrangler secret put
//   CRON_SECRET` (never committed) — same value as the other crons.
// OBSERVABILITY: logs the route's HTTP status + JSON body ({ok,breachCount,
//   emailed,checks}) so `wrangler tail lullawood-healthcheck` shows each run.
// ON DEMAND: to see the report without waiting for 7am, hit the route yourself:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://lullawood.com/api/cron/health-check?dry=1"
// =============================================================================
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(pingHealthCheck(env));
  },
};

async function pingHealthCheck(env) {
  try {
    const res = await fetch("https://lullawood.com/api/cron/health-check", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    console.log(`health-check: HTTP ${res.status} ${body}`);
  } catch (err) {
    console.error("health-check: fetch failed —", err instanceof Error ? err.message : String(err));
  }
}
