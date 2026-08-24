# lullawood-weekly-digest (cron Worker)

Emails the Monday-morning operator digest: five lines (demos, signups, trials,
actives, churn) plus the channel table as plain text. Calls the secret-gated
Pages route `https://lullawood.com/api/cron/weekly-digest`, which does the
querying and sends via Resend.

Pages Functions can't hold a cron trigger, which is why this separate Worker
exists.

## Schedule — why two cron lines

`crons = ["0 15 * * 1", "0 16 * * 1"]`

Cron triggers fire on UTC. 8am Pacific is 15:00 UTC under PDT and 16:00 UTC
under PST, so a single line would drift an hour twice a year. Both fire; the
Worker asks `Intl` what time it is in `America/Los_Angeles` and exits unless it
is Monday 08:00 there. Exactly one firing per Monday does the work.

## One-time setup

```bash
# 1. Same CRON_SECRET the other cron Workers use, on this Worker.
cd workers/digest
npx wrangler secret put CRON_SECRET

# 2. Where the digest goes (optional — defaults to stephenpdonnelly@gmail.com).
npx wrangler pages secret put DIGEST_TO --project-name=lullawood

# 3. Deploy the Worker (registers the cron trigger).
npx wrangler deploy
```

`CRON_SECRET` and `RESEND_API_KEY` must already be set on the Pages project —
they are, for the nightly and trial-reminder crons.

## Verify

```bash
# Render the digest WITHOUT sending it (needs the secret; safe to run anytime).
curl -H "authorization: Bearer $CRON_SECRET" \
  "https://lullawood.com/api/cron/weekly-digest?dry=1"

# Unauthorized without the secret -> 401.
curl -i https://lullawood.com/api/cron/weekly-digest

# Watch scheduled runs live (shows the skip lines too).
npx wrangler tail lullawood-weekly-digest

# Force a run without waiting for Monday. NOTE: it will log a skip unless it
# happens to be Mon 08:00 in Los Angeles — that is the guard working.
npx wrangler dev --test-scheduled   # then hit http://localhost:8787/__scheduled
```
