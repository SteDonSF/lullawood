# Deploying Lullawood (soft launch)

This gets a **shareable live site** online: the storybook landing page, the working
"Write their first story" demo, and a **waitlist** that captures signups. Stripe billing
and the nightly story engine are intentionally **not** live yet.

Your workflow mirrors hithegas: **push to GitHub → Cloudflare builds & deploys.**

---

## What you need
- A GitHub account (private repo is fine)
- A Cloudflare account
- The domain `lullawood.com`
- An **Anthropic API key** (for the demo) — from console.anthropic.com
- A **Neon Postgres** database (free) — for the waitlist — from neon.tech

---

## Step 1 — Push the code to GitHub
1. Create a new **private** repo, e.g. `SteDonSF/lullawood`.
2. Upload the contents of this folder (same as your hithegas flow — web UI upload or git).

## Step 2 — Create the database (for the waitlist)
1. At neon.tech, create a project. Copy the **connection string** (starts `postgresql://…`). This is your `DATABASE_URL`.
2. Locally, create `.env.local` with `DATABASE_URL=…`, then run:
   ```
   npm install
   npm run db:push
   ```
   That creates the tables (including `waitlist`). One-time.

## Step 3 — Connect Cloudflare Pages
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. Build settings:
   - **Framework preset:** Next.js
   - **Build command:** `npx @cloudflare/next-on-pages@1`
   - **Build output directory:** `.vercel/output/static`
3. **Settings → Functions → Compatibility flags:** add `nodejs_compat` to **Production** *and* **Preview**.

## Step 4 — Environment variables (Cloudflare → Settings → Environment variables)
| Variable | Value | Needed for |
|---|---|---|
| `ANTHROPIC_API_KEY` | your key | the live story demo |
| `DATABASE_URL` | your Neon string | the waitlist |
| `WAITLIST_NOTIFY` | your email *(optional)* | get emailed each signup |
| `RESEND_API_KEY` | *(optional)* | sending the notify email |

Add them to **both** Production and Preview. Redeploy after adding.

## Step 5 — Point the domain
Cloudflare Pages → **Custom domains → Set up a domain** → `lullawood.com` (and `www`). Cloudflare handles DNS + SSL.

## Step 6 — Verify
- Landing page loads, artwork shows.
- The demo writes a story (needs `ANTHROPIC_API_KEY`).
- Enter an email in the waitlist → you see "You're on the list." Confirm the row appears in your Neon `waitlist` table.

---

## What's live vs not
**Live:** landing page, story demo, waitlist capture, legal pages.
**Not live yet (next phase):** Stripe checkout, the nightly generate-and-send engine, narrated audio, printed keepsakes.

## Before you share widely
- Have the **legal pages** (privacy / terms / child-safety) reviewed by counsel for your jurisdiction — there is a `TODO` on governing law in `terms`.
- Confirm **testimonial permission** from each friend quoted.
- Confirm the **Lullawood trademark** position before public launch.

---

## Admin dashboard + weekly digest (added 2026-08-22)

### Secrets

All are Cloudflare secrets, read server-side only. None are `NEXT_PUBLIC_*` —
the Plausible API key in particular must never reach the browser.

```bash
# Plausible Stats API — powers the funnel section.
npx wrangler pages secret put PLAUSIBLE_API_KEY --project-name=lullawood

# Cloudflare Access JWT verification (see SECURITY below). Strongly recommended.
npx wrangler pages secret put CF_ACCESS_TEAM_DOMAIN --project-name=lullawood  # lullawood.cloudflareaccess.com
npx wrangler pages secret put CF_ACCESS_AUD --project-name=lullawood          # Access app > Overview > Application Audience (AUD) Tag

# Where the Monday digest goes (optional; defaults to the owner address).
npx wrangler pages secret put DIGEST_TO --project-name=lullawood

# The digest Worker needs the SAME CRON_SECRET as the other cron Workers.
cd workers/digest && npx wrangler secret put CRON_SECRET && npx wrangler deploy
```

Pages secrets need a redeploy to take effect on this project.

### SECURITY — the admin wall

`/api/admin/*` is protected by `requireAccess()` in `src/lib/access.ts`, NOT by
the page being behind Cloudflare Access. Two independent layers:

1. **Host allowlist** — admin routes answer only on `lullawood.com` /
   `www.lullawood.com`. Cloudflare Access is bound to a hostname, so
   `lullawood.pages.dev` and per-deployment `<hash>.lullawood.pages.dev` sit
   OUTSIDE the wall. This layer needs no configuration and holds on its own.
2. **JWT verification** — when `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` are
   set, the `Cf-Access-Jwt-Assertion` is verified against Cloudflare's JWKS
   (RS256 signature, audience, issuer, expiry). Unset, it degrades to a
   presence check, which is safe only because layer 1 guarantees the request
   arrived on a hostname where Cloudflare itself set that header.

Do not remove layer 1 on the assumption that layer 2 covers it.

Also worth doing in the Cloudflare dashboard: add an Access application
covering `*.lullawood.pages.dev`, or disable preview URLs for the project, so
the origin is never reachable off the canonical hostname at all.

### Verify the wall

```bash
# Behind Access on the apex -> 302 to the Access login.
curl -s -o /dev/null -w "%{http_code}\n" https://lullawood.com/api/admin/metrics

# Off the canonical host -> 403, even with a forged assertion header.
curl -s -H "Cf-Access-Jwt-Assertion: forged" \
  https://lullawood.pages.dev/api/admin/metrics
```
