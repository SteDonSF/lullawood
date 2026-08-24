// =============================================================================
// Lullawood daily health-check cron Worker.
// -----------------------------------------------------------------------------
// WHY: Cloudflare Pages Functions can't own a Cron Trigger — only Workers can.
//   So this tiny Worker holds the schedule and fetch()es the secret-gated Pages
//   route (/api/cron/health-check), which runs the checks and emails ONE alert
//   listing every breach.
// SILENCE IS THE POINT: the route emails only when something breached a
//   threshold. No email means everything passed.
//
// TWO SCHEDULES, one route, selected by ?mode=:
//   0 14 * * *  ->  daily     page speed, uptime, funnel, conversion, cron
//                             health, error rate, synthetic canary.
//   0 19 * * *  ->  delivery  every child on an active subscription got a story
//                             AND a Resend message id — run an hour after the
//                             18:00 UTC nightly job, because at 14:00 tonight's
//                             stories don't exist yet and it would flag everyone.
//
// AUTH: sends  Authorization: Bearer <CRON_SECRET>. Must match the value on the
//   Pages project. Set it here with `wrangler secret put CRON_SECRET` (never
//   committed) — same value as the other crons.
// OBSERVABILITY: logs the mode, HTTP status and JSON body ({ok,mode,breachCount,
//   emailed,checks}) so `wrangler tail lullawood-healthcheck` shows each run.
// ON DEMAND: to see a report without waiting, hit the route yourself —
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://lullawood.com/api/cron/health-check?dry=1&mode=all"
// =============================================================================

// Cron expression -> mode. Must stay in step with wrangler.toml; an expression
// that isn't listed here falls back to the daily set rather than silently
// running nothing.
const MODES = {
  "0 14 * * *": "daily",
  "0 19 * * *": "delivery",
};

export default {
  async scheduled(event, env, ctx) {
    const mode = MODES[event.cron] ?? "daily";
    ctx.waitUntil(pingHealthCheck(env, mode));
  },
};

async function pingHealthCheck(env, mode) {
  try {
    const res = await fetch(`https://lullawood.com/api/cron/health-check?mode=${mode}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    console.log(`health-check[${mode}]: HTTP ${res.status} ${body}`);
  } catch (err) {
    console.error(`health-check[${mode}]: fetch failed —`, err instanceof Error ? err.message : String(err));
  }
}
