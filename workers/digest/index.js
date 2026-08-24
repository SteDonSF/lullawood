// =============================================================================
// Lullawood weekly-digest cron Worker.
// -----------------------------------------------------------------------------
// WHY: Cloudflare Pages Functions can't own a Cron Trigger — only Workers can.
//   So this Worker holds the schedule and fetch()es the secret-gated Pages route
//   (/api/cron/weekly-digest), which queries Neon and sends the email.
//
// WHY TWO CRON LINES: cron triggers fire on UTC, and 8am Pacific is 15:00 UTC in
//   summer (PDT) but 16:00 UTC in winter (PST). A single UTC hour would drift by
//   an hour twice a year. So we fire at BOTH hours every Monday and let the
//   Worker decide: it asks Intl what time it actually is in Los Angeles and
//   returns immediately unless it is Monday, 8am there. Exactly one of the two
//   firings passes that test on any given Monday, year-round.
//
// AUTH: sends  Authorization: Bearer <CRON_SECRET>. Must match the Pages
//   project's CRON_SECRET (same value as the other cron Workers).
//   Set here with `wrangler secret put CRON_SECRET` — never committed.
// =============================================================================
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(maybeSendDigest(env));
  },
};

// What day and hour is it in Los Angeles right now? Intl handles PST/PDT for us,
// including the exact DST changeover dates, which is the whole reason we ask it
// instead of doing arithmetic on UTC offsets.
function losAngelesNow(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")) };
}

async function maybeSendDigest(env) {
  const { weekday, hour } = losAngelesNow(new Date());

  if (weekday !== "Mon" || hour !== 8) {
    // The other of the two Monday firings. Expected, not an error.
    console.log(`weekly-digest: skipped — it is ${weekday} ${hour}:00 in Los Angeles, not Mon 08:00`);
    return;
  }

  try {
    const res = await fetch("https://lullawood.com/api/cron/weekly-digest", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    console.log(`weekly-digest: HTTP ${res.status} ${body}`);
  } catch (err) {
    console.error("weekly-digest: fetch failed —", err instanceof Error ? err.message : String(err));
  }
}
