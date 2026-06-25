# Lullawood

A personalized bedtime story for your child, every night — the bedtime world where your child is the hero.
Built for parents 28–45. Premium storybook, not generic SaaS.

## Stack
- **Next.js 14** (App Router) · **TypeScript** · **Tailwind**
- Fully responsive · the story panel is always the dark "night window"
- Integrations wired and typed (no live keys committed): **Anthropic**, **Stripe**, **Resend**, **ElevenLabs**, **PostgreSQL** (Drizzle + Neon serverless), **Cloudflare Worker** (nightly cron)

## Run it
```bash
npm install
cp .env.example .env.local   # fill in keys as you wire each integration
npm run dev                  # http://localhost:3000
```
The homepage and the live demo work with just `ANTHROPIC_API_KEY` set. Everything else
is a typed stub you switch on when ready.

## What's built
- **Homepage** — all seven sections plus FAQ, About (founder), and footer:
  Hero · live Demo · Why Lullawood (6) · How It Works (3, illustrated) · Testimonials ·
  Pricing (Family highlighted) · About · FAQ · Final CTA.
- **/start** — the first-story onboarding flow (profile → live first story → trial).
- **/api/generate-story** — real, server-side Anthropic call (key never hits the browser).
- **/api/profile**, **/api/checkout** — typed stubs for DB + Stripe.
- **src/worker/** — the nightly Cloudflare Worker that makes "Lullawood remembers" real.
- **src/lib/content.ts** — all copy in one place. Edit here, not in components.

## Artwork
You're sourcing illustration externally (see `ART_BRIEF.md` for exact specs).
Every art zone is an `<Illustration slot="…" placeholder />`. Drop a `.webp` into
`/public/art/<slot>.webp`, flip `placeholder={false}` (or set the Hero/FinalCTA
background-image), and remove the dashed badge. No layout rework needed.

## Wiring the integrations
| Integration | File | To activate |
|---|---|---|
| Anthropic | `src/lib/anthropic.ts` | set `ANTHROPIC_API_KEY` |
| Postgres | `src/lib/db/*` | set `DATABASE_URL`, then `npm run db:push` |
| Stripe | `src/lib/stripe.ts`, `api/checkout` | set secret + price IDs, uncomment session create |
| Resend | `src/lib/resend.ts` | set `RESEND_API_KEY` |
| ElevenLabs | `src/lib/elevenlabs.ts` | set key + voice ID |
| Nightly engine | `src/worker/nightly.ts` | `wrangler secret put …`, then `npm run worker:deploy` |

## Deploy (Cloudflare)
`npm run cf:build` (uses `@cloudflare/next-on-pages`) then deploy via Pages.
Postgres from the edge uses Neon's HTTP driver; swap to Hyperdrive if you bring your own DB.

## A note on trust
Testimonials and the founder story ship as clearly-marked placeholders. For a parenting
brand, use only **real** quotes/photos (with permission) and a **true** founder story.
