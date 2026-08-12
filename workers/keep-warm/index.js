// =============================================================================
// Lullawood keep-warm cron Worker.
// -----------------------------------------------------------------------------
// WHY: Cloudflare isolates + the Neon HTTP connection go cold when idle, which
//   showed up as 15-20s first-login latency (UX audit P2-1). This tiny Worker
//   pings the auth/session, subscription, and the two hottest pages every 5
//   minutes so the login path stays warm and logins are sub-second.
// NOTE: the requests don't need to succeed (session/subscription 401 when
//   unauthenticated is fine) — the point is to keep the code paths warm.
// =============================================================================
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      Promise.all([
        fetch("https://lullawood.com/api/auth/session", {
          method: "GET",
          headers: { "x-keep-warm": "1" }
        }),
        fetch("https://lullawood.com/api/subscription", {
          method: "GET",
          headers: { "x-keep-warm": "1" }
        }),
        fetch("https://lullawood.com/try", {
          method: "GET"
        }),
        fetch("https://lullawood.com/dashboard", {
          method: "GET"
        })
      ]).then(() => console.log("Keep-warm ping complete"))
    );
  }
};
