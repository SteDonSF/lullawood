# lullawood-healthcheck (cron Worker)

Runs the product health check. Cloudflare **Cron Triggers** fire this Worker
**twice a day**; each call hits the secret-gated Pages route
`https://lullawood.com/api/cron/health-check` with a `?mode=`, and the route
emails **one** message listing every breach.

| Cron (UTC) | `?mode=` | Runs |
|---|---|---|
| `0 14 * * *` | `daily` | checks 1-7 (7am PT / 6am PST) |
| `0 19 * * *` | `delivery` | check 8, an hour after the 18:00 nightly job |

The split matters: at 14:00 tonight's stories don't exist yet, so running the
delivery check then would flag every child, every day.

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
| 7 | **Synthetic canary** — one real story, generated + saved + sent | any step fails, or the whole thing takes over 60s | the nightly route's own `?force=1&childId=` hooks |
| 8 | **Story delivery** *(19:00)* — every child on an active sub | no story tonight, **or** no Resend message id logged | `children`, `subscriptions`, `stories`, `api_events` |

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

The nightly-stories cron now also writes to `api_events`:

- One **run marker** per night (`route = 'cron-nightly-stories'`). Without it,
  "the cron never fired" and "it fired and delivered nothing" are
  indistinguishable from outside, and check 5 can only report the vaguer of the two.
- One **delivery record per child** (`route = 'nightly-delivery'`), carrying
  Resend's message id: `child=<uuid> resend=<id>`. Status 200 means Resend
  accepted it with an id; 502 means the send failed. A co-star night is ONE
  email covering TWO children, so it writes a row for each — otherwise check 8
  would cry wolf over the sibling.

That second one is the point of check 8. A story row in the database proves
generation worked; it says nothing about whether mail left the building. The
message id is the first moment the send becomes somebody else's problem, and it's
what you'd hand Resend support to trace a specific night.

## The canary (check 7)

Needs a dedicated child on an account with an **active or trialing**
subscription, whose parent email is a canary inbox you don't mind receiving a
story every morning. Set `CANARY_CHILD_ID` to that child's uuid; leave it unset
and the check reports `skipped` and stays silent.

It doesn't reimplement generation — it calls the nightly cron's own secret-gated
test hooks (`?force=1&childId=`), which confine the run to that one child and
bypass the once-a-day idempotency. Whatever breaks for the canary breaks for a
paying customer, because it is the same code path.

Because the canary generates a story at 14:00, the real 18:00 nightly run skips
that child (a story already exists for today), and check 8 still passes — the
14:00 run logged a delivery record.

## One-time setup

```bash
# 1. Create the page_speed table (once, against Neon).
psql "$DATABASE_URL" -f drizzle/0006_health_check.sql

# 2. Where the alert lands (defaults to stephenpdonnelly@gmail.com, same as
#    the digest's DIGEST_TO).
npx wrangler pages secret put HEALTHCHECK_TO --project-name=lullawood

# 2b. The canary child's uuid (optional — check 7 skips without it).
npx wrangler pages secret put CANARY_CHILD_ID --project-name=lullawood

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
# mode=all runs checks 1-8 — only meaningful after 19:00 UTC, since the delivery
# check needs tonight's nightly run to have happened.
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://lullawood.com/api/cron/health-check?dry=1&mode=all" | jq

# Just the delivery check (this is what the 19:00 trigger sends).
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://lullawood.com/api/cron/health-check?dry=1&mode=delivery" | jq

# Unauthorized without the secret -> 401.
curl -i https://lullawood.com/api/cron/health-check

# Watch scheduled runs live (HTTP status + {ok,breachCount,emailed,checks}).
npx wrangler tail lullawood-healthcheck

# Force a run without waiting for the schedule.
npx wrangler dev --test-scheduled   # then hit http://localhost:8787/__scheduled
```

A `daily` run takes ~60-90s: PageSpeed Insights and the canary's real story
generation are the slow parts, and everything runs in parallel. A `delivery` run
is a single query and returns in well under a second.

## Schedule

`crons = ["0 14 * * *", "0 19 * * *"]`. Cron triggers are UTC and don't follow
daylight saving, so 14:00 is 7am PT in summer and 6am PST in winter.

`index.js` maps each cron expression to its mode — **change an hour in
`wrangler.toml` and the matching string in `index.js` must change with it**, or
that trigger silently falls back to the daily set.

If you move the nightly job off 18:00 UTC, update `CONFIG.delivery.nightlyHourUtc`
in the route as well; it's what excludes children created after tonight's run
started.

Both runs are safe to repeat: they read the site, write their own `page_speed`
and `api_events` rows, and send at most one email each. The one exception is the
canary, which generates a real story and sends real mail — to the canary inbox
only.
