// =============================================================================
// Lullawood trial-reminder cron Worker.
// -----------------------------------------------------------------------------
// WHY: Cloudflare Pages Functions can't own a Cron Trigger — only Workers can.
//   So this tiny Worker runs on a schedule and fetch()es the secret-gated Pages
//   route (/api/cron/trial-reminder), which does the actual query + emailing.
// AUTH: sends  Authorization: Bearer <CRON_SECRET>. CRON_SECRET must match the
//   value set on the Pages project (`wrangler pages secret put CRON_SECRET`).
//   Set it here with `wrangler secret put CRON_SECRET` (never committed).
// OBSERVABILITY: logs the route's HTTP status + JSON body ({ok,scanned,sent,
//   failed}) so `wrangler tail lullawood-trial-reminder` shows each run.
// =============================================================================
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(pingTrialReminder(env));
  },
};

async function pingTrialReminder(env) {
  try {
    const res = await fetch("https://lullawood.com/api/cron/trial-reminder", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    console.log(`trial-reminder: HTTP ${res.status} ${body}`);
  } catch (err) {
    console.error("trial-reminder: fetch failed —", err instanceof Error ? err.message : String(err));
  }
}
