# lullawood-healthcheck (cron Worker)

Runs the daily product health check. A Cloudflare **Cron Trigger** fires this
Worker at **14:00 UTC (7am PT)**; it calls the secret-gated Pages route
`https://lullawood.com/api/cron/health-check`, which runs six checks and emails
**one** alert listing every breach.

**Silence means everything passed.** The route sends no email at all when
nothing crossed a threshold — so an email in your inbox always means "look at
this".

Pages Functions can't hold a cron trigger, which is why this separate Worker
exists (same shape as `workers/cron` and `workers/nightly`).

## The checks

| # | Check | Alerts when |
|---|---|---|
| 1 | **Page speed** — PageSpeed Insights (mobile) for `/` and `/try` | LCP > 3.5s, or performance score < 50 |
| 2 | **Uptime + latency** — `/`, `/try`, `/pricing` (HEAD), `/api/generate-story` (OPTIONS) | any non-2xx, or TTFB > 2s |
| 3 | **Funnel rate** — Plausible: `demo_started` ÷ unique visitors on `/` + `/try`, 24h | below 6% — only once 50+ visitors |
| 4 | **Conversion drought** — Plausible: `signup_completed`, 48h | 150+ visitors produced zero signups |
| 5 | **Cron health** — nightly delivery | the nightly cron didn't run, or delivered 0 stories while active subs > 0 |
| 6 | **Error rate** — `api_events`, 24h | 402/429/5xx above 5% of `/api/generate-story` requests |

Every check records what it measured: check 1 writes a row per page per run into
`page_speed` (surfaced on `/admin/dashboard` under **Product health**), and the
run itself is logged to `api_events`.

**All thresholds live in one `CONFIG` object at the top of
`src/app/api/cron/health-check/route.ts`.** Tune the numbers there — never in
the logic below them.

## One-time setup

```bash
# 1. Create the two tables (once, against your Neon database).
psql "$DATABASE_URL" -f drizzle/0003_health_check.sql
#    ...or `npm run db:push` if you'd rather let drizzle-kit diff the schema.

# 2. Same CRON_SECRET this Worker sends must already be on the Pages project
#    (it is — the trial-reminder and nightly crons share it):
npx wrangler pages secret put CRON_SECRET --project-name=lullawood   # if not set yet

# 3. Where the alert lands, on the Pages project:
npx wrangler pages secret put HEALTHCHECK_ALERT_TO --project-name=lullawood

# 4. (Optional) Plausible, for checks 3 + 4. Without these the two funnel
#    checks report "skipped" and stay silent — they never false-alarm.
npx wrangler pages secret put PLAUSIBLE_API_KEY --project-name=lullawood
npx wrangler pages secret put PLAUSIBLE_SITE_ID --project-name=lullawood   # e.g. lullawood.com

# 5. Redeploy Pages so the route picks up the new secrets (env changes need a
#    fresh deploy on this project).
npx @cloudflare/next-on-pages \
  && npx wrangler pages deploy .vercel/output/static --project-name=lullawood

# 6. Secret on this Worker (so it can send the Bearer token), then deploy it.
cd workers/healthcheck
npx wrangler secret put CRON_SECRET
npx wrangler deploy
```

### Environment variables the route reads

| Variable | Where | Needed for |
|---|---|---|
| `CRON_SECRET` | Pages **and** this Worker | authenticating the call (shared with the other crons) |
| `HEALTHCHECK_ALERT_TO` | Pages | the alert recipient (falls back to `WAITLIST_NOTIFY`) |
| `RESEND_API_KEY` | Pages | sending the alert (already set) |
| `DATABASE_URL` | Pages | checks 5 + 6, and the `page_speed` history (already set) |
| `PLAUSIBLE_API_KEY` | Pages | checks 3 + 4 — omit and they skip |
| `PLAUSIBLE_SITE_ID` | Pages | checks 3 + 4 — omit and they skip |
| `PLAUSIBLE_HOST` | Pages | only if self-hosting Plausible (default `https://plausible.io`) |
| `PAGESPEED_API_KEY` | Pages | optional — PSI is free without a key at this volume |

## Verify

```bash
# See the whole report on demand — ?dry=1 renders every check and ALWAYS emails,
# even when nothing breached.
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://lullawood.com/api/cron/health-check?dry=1" | jq

# Unauthorized without the secret -> 401.
curl -i https://lullawood.com/api/cron/health-check

# Watch scheduled runs live (HTTP status + {ok,breachCount,emailed,checks}).
npx wrangler tail lullawood-healthcheck

# Force a run without waiting for the schedule.
npx wrangler dev --test-scheduled   # then hit http://localhost:8787/__scheduled
```

A real run takes ~30-60s — PageSpeed Insights is the slow part, and both pages
are measured in parallel.

## Schedule

`crons = ["0 14 * * *"]` — daily 14:00 UTC. Cron triggers are UTC and don't
follow daylight saving, so this is 7am PT in summer and 6am PST in winter.
Change it in `wrangler.toml` and re-`deploy`. Daily is safe: the run only reads
the site, writes its own `page_speed` / `api_events` rows, and emails at most
one message.
