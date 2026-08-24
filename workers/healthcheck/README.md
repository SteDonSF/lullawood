# lullawood-healthcheck (cron Worker)

Runs the daily product health check. A Cloudflare **Cron Trigger** fires this
Worker at **14:00 UTC (7am PT)**; it calls the secret-gated Pages route
`https://lullawood.com/api/cron/health-check`, which runs six checks and emails
**one** message listing every breach.

**Silence means everything passed.** No email is sent when nothing crossed a
threshold — so an email in the inbox always means "look at this".

Pages Functions can't hold a cron trigger, which is why this separate Worker
exists (same shape as `workers/cron`, `workers/nightly` and `workers/digest`).

## The checks

| # | Check | Alerts when | Reads |
|---|---|---|---|
| 1 | **Page speed** — PageSpeed Insights (mobile), `/` and `/try` | LCP > 3.5s, or score < 50 | PSI API → writes `page_speed` |
| 2 | **Uptime + latency** — `/`, `/try`, `/pricing` (HEAD), `/api/generate-story` (OPTIONS) | any non-2xx, or TTFB > 2s | the live site |
| 3 | **Funnel rate** — `demo_started` ÷ unique visitors on `/` + `/try`, 24h | below 6% — only at 50+ visitors | Plausible Stats API |
| 4 | **Conversion drought** — `signup_completed`, 48h | 150+ visitors, zero signups | Plausible Stats API |
| 5 | **Cron health** — nightly delivery | the nightly cron didn't run, or delivered 0 while active subs > 0 | `api_events`, `stories`, `subscriptions` |
| 6 | **Error rate** — story generation, 24h | 402/429/5xx above 5% of requests | `api_events` |

Checks 3 and 4 use the funnel events the site already fires (`src/lib/analytics.ts`)
through the existing Stats API client (`src/lib/plausible.ts`). Checks 5 and 6
read the `api_events` log that `/api/generate-story` already writes. The SQL for
both lives in `src/lib/metrics.ts` alongside the rest of the dashboard's queries.

**All thresholds live in one `CONFIG` object at the top of
`src/app/api/cron/health-check/route.ts`.** Tune the numbers there — never in
the logic below them.

## What it adds to the database

One table, `page_speed` (`drizzle/0006_health_check.sql`). It is not a request
log — it's an outside-in measurement of the public site on a schedule, which is
why it doesn't live in `api_events`. The last 7 days are surfaced on
`/admin/dashboard` under **Product health**.

The nightly-stories cron now also writes one run marker per night to
`api_events` (`route = 'cron-nightly-stories'`). Without it, "the cron never
fired" and "it fired and delivered nothing" are indistinguishable from outside,
and check 5 can only report the vaguer of the two.

## One-time setup

```bash
# 1. Create the page_speed table (once, against Neon).
psql "$DATABASE_URL" -f drizzle/0006_health_check.sql

# 2. Where the alert lands (defaults to stephenpdonnelly@gmail.com, same as
#    the digest's DIGEST_TO).
npx wrangler pages secret put HEALTHCHECK_TO --project-name=lullawood

# 3. Redeploy Pages so the route ships and picks up the secret.
npx @cloudflare/next-on-pages \
  && npx wrangler pages deploy .vercel/output/static --project-name=lullawood

# 4. Secret on this Worker (same CRON_SECRET the other crons use), then deploy.
cd workers/healthcheck
npx wrangler secret put CRON_SECRET
npx wrangler deploy
```

`CRON_SECRET`, `RESEND_API_KEY`, `DATABASE_URL`, `PLAUSIBLE_API_KEY` and
`PLAUSIBLE_SITE_ID` are already set on the Pages project — the digest and admin
dashboard use them. `PAGESPEED_API_KEY` is optional; PSI is free without a key
at this volume.

If `PLAUSIBLE_API_KEY` were ever unset, checks 3 and 4 report `skipped` and stay
silent rather than firing a false alert.

## Verify

```bash
# The whole report on demand. ?dry=1 renders every check AND sends the email,
# even with nothing breached, so it proves delivery works too.
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
the site, writes its own `page_speed` and `api_events` rows, and sends at most
one email.
