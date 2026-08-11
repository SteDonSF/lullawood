// =============================================================================
// Lullawood nightly-delivery cron Worker.
// -----------------------------------------------------------------------------
// WHY: Cloudflare Pages Functions can't own a Cron Trigger — only Workers can.
//   So this tiny Worker runs on a schedule and fetch()es the secret-gated Pages
//   route (/api/cron/nightly-stories), which does the actual generation +
//   emailing for every active/trialing subscriber's children.
// AUTH: sends  Authorization: Bearer <CRON_SECRET>. CRON_SECRET must match the
//   value set on the Pages project. Set it here with `wrangler secret put
//   CRON_SECRET` (never committed) — same value as the trial-reminder cron.
// OBSERVABILITY: logs the route's HTTP status + JSON body ({ok,total,succeeded,
//   failed,skipped}) so `wrangler tail lullawood-nightly` shows each run.
// =============================================================================
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(pingNightlyStories(env));
  },
};

async function pingNightlyStories(env) {
  try {
    const res = await fetch("https://lullawood.com/api/cron/nightly-stories", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    console.log(`nightly-stories: HTTP ${res.status} ${body}`);
  } catch (err) {
    console.error("nightly-stories: fetch failed —", err instanceof Error ? err.message : String(err));
  }
}
