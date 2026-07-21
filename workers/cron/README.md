# lullawood-trial-reminder (cron Worker)

Fires the trial-ending reminder email. A Cloudflare **Cron Trigger** runs this
Worker on a schedule; it calls the secret-gated Pages route
`https://lullawood.com/api/cron/trial-reminder`, which queries Neon and sends
`sendTrialEndingEmail()` to any trialing parent whose trial ends within 48h and
who hasn't been reminded yet (guarded by `subscriptions.trial_reminder_sent`).

Pages Functions can't hold a cron trigger, which is why this separate Worker
exists.

## One-time setup

All three use your existing `wrangler login`. The two secret prompts must
receive the **same** long random string — enter it interactively, never in a
committed file or chat.

```bash
# 1. Secret on the Pages project (so the route can authenticate callers).
npx wrangler pages secret put CRON_SECRET --project-name=lullawood

# 1b. Redeploy Pages so the route picks up the new secret (env changes need a
#     fresh deploy on this project).
npx @cloudflare/next-on-pages \
  && npx wrangler pages deploy .vercel/output/static --project-name=lullawood

# 2. Same secret on this Worker (so it can send the Bearer token).
cd workers/cron
npx wrangler secret put CRON_SECRET

# 3. Deploy the Worker (registers the cron trigger).
npx wrangler deploy
```

## Verify

```bash
# Unauthorized without the secret -> 401 (before secret set, the route 500s).
curl -i https://lullawood.com/api/cron/trial-reminder

# Watch scheduled runs live (HTTP status + {ok,scanned,sent,failed}).
npx wrangler tail lullawood-trial-reminder

# Force a run without waiting for the schedule.
npx wrangler dev --test-scheduled   # then hit http://localhost:8787/__scheduled
```

## Schedule

`crons = ["0 16 * * *"]` — daily 16:00 UTC. Change in `wrangler.toml` and
re-`deploy`. Daily is safe: the route de-dupes via `trial_reminder_sent`.
