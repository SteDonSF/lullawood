# Lullawood — Product Roadmap (living document)

*The single source of truth for where Lullawood is going. Glance at §1 for "what now." Everything below is rationale, design, vision, and history. Updated every session — replace the project copy with the latest version each time. **Bump the date + time stamp below on every save** so the newest copy is always obvious.*

**Last updated:** 30 Jun 2026 · 11:40 PT · **Status:** soft-launch live on lullawood.com. **⭐ GL-1 STRIPE GO-LIVE — FULLY STAGED, PENDING STRIPE ACCOUNT REVIEW.** Live account activated (legal entity = Newforge Advisory Partners LLC; public/DBA name = Lullawood); 2 live products + 4 live prices created (copied from sandbox, verified correct amounts); live webhook registered (`/api/stripe/webhook`, 3 events matching the handler); all **7 live env vars** set in Cloudflare (secret key + webhook secret encrypted) and **deployed green**. **The ONLY thing left is Stripe's own account review ("2–3 days") + then ONE real-card test** — not in our control, blocks the first real charge. `curl /api/checkout` → 405 (healthy, route loads clean). **OPS-1 (diag route) — DONE** (deleted + verified 404 earlier this session). **Pricing validated** against 2026 market (see §4 + new `PRODUCT-SHEET.md` / `MARKETING-STRATEGY.md`): $8.99/$12.99 confirmed correct, memory stays at entry tier. **NOT yet taking real money** until review clears + the real-card test passes. **⚠️ API-version note:** code pins `2024-06-20`, live webhook is on account default `2026-06-24.dahlia` — low-risk (core subscription fields stable), but **watch the real-card test** to confirm the webhook writes a `subscriptions` row.

---

## 1. Prioritized roadmap — the at-a-glance view

### ✅ DONE (live on lullawood.com)
- Marketing site · 8-character friends gallery (consistent art) · founder dashboard behind Cloudflare Access · legal pages
- Strong Sonnet story engine: character bibles, 4-beat arc, calming wind-down · **token-cutoff fix** (`max_tokens` 2400 + "ALWAYS FINISH THE STORY") · **signature ending** ("Goodnight, Lullawood. Goodnight, [NAME].")
- **Demo:** exact-age input · age-scaled stakes (gentle → real, always resolving into sleep) · co-star / sibling mode · free-text "describe your own adventure" (precedence over chips) · story-length selector (decoupled from age) · no-markdown rule
- **AUTH — LIVE:** Better Auth (edge) + Neon. Signup, login, logout, sessions, **password reset** (Resend, domain verified). `/signup` `/login` `/forgot-password` `/reset-password` `/dashboard` (cream/gold). **Cloudflare Access re-scoped** off `/dashboard` → `/admin/dashboard` so parents aren't walled; parent dashboard protected in-app by session.
- **PHASE 2 — child profiles LIVE:** one-identity schema (children → `user.id`, `parents` dropped, `about_text` + `avoid_list` added — §9a); secure `/api/profile` (session-scoped) + `getSessionUser()`; parent dashboard; **add-a-child form** (`/dashboard/children/new`); **single-child view** (`/dashboard/children/[id]`).
- **PHASE 3 — episodic memory loop LIVE (not yet user-tested):** `summarizeStory()` (Haiku) saves a one-line summary per story; last ~6 summaries fed as `previousAdventures` into the next prompt + anti-repetition instruction. Durable/semantic "growth" memory deferred (see §12).
- **⭐ STRIPE MONETIZATION — LIVE IN TEST MODE (proven end-to-end):**
  - Products: **Dreamer** $8.99/mo · $89.99/yr (1 child) · **Family** $12.99/mo · $129.99/yr (up to 4). 7-day trial, "2 months free" annual framing. Keepsake tier deferred until audio+books exist.
  - Full pipe verified: pricing page → checkout → Stripe → **webhook → `subscriptions` table** (confirmed row). `subscriptions` keyed to `user.id`.
  - **Gating:** story generation (Mode A) returns 402 without an active trial/sub. **Child cap:** Dreamer 1 / Family 4, enforced in `/api/profile` POST (402 no-sub, 403 at-limit). `getAccess()` = single source of truth, **fails closed**.
  - **Billing portal LIVE & tested:** `/api/billing-portal` → Stripe-hosted portal; self-serve **cancel** confirmed. Dashboard shows plan + trial date + Manage button.
  - **402 → /pricing redirect** wired into single-child view + add-child form.
- **⭐ CONVERSION FUNNEL REBUILD — LIVE (28 Jun session):**
  - **Marketing made honest (P0):** homepage prices aligned to real Stripe numbers; Keepsake tier removed; narrated audio / "read in your voice" softened to "coming soon"; **waitlist section removed entirely**; all CTAs ("Start free trial") route to `/signup`.
  - **Conversion spine (P1-1):** demo story → "Start [name]'s free trial" CTA (at peak, under the story) → `/signup` → add-child → `/pricing`. **Name + age + animal carried through** the whole chain via URL params. Signup + add-child use `useSearchParams` inside `<Suspense>`.
  - **Demo simplified (P1-2):** only name/age/companion/adventure visible; colour, length, free-text collapsed under a two-way **"+ More options" / "− Fewer options"** toggle. Age now a **placeholder** ("6"), not a pre-filled value (falls back to 6 server-side).
  - **Demo example story (P1-4):** night panel seeds a personalized example ("Maya and the Tide of Lanterns" — named hero, Fern, ocean, labelled "for Maya, age 6, who chose the ocean") on load, replaced when they generate their own.
  - **Polish:** CTA visual upgrade (✦ sparkles, glow, fade-rise) **with `prefers-reduced-motion` guard**; signup email errors humanized (no raw `[body.email]`); signup + add-child **warmed** (brand `Mark` glyph, centered, trust line "7-night free trial · No charge today · Cancel anytime"); **"Log in" link added to public nav** ✅ (was outstanding).
- **⭐ STORYBOOK DEMO READER + GO-LIVE GATES CLEARED — LIVE (29 Jun session):**
  - **Paged "storybook" reader:** the demo story now renders as a horizontal page-turn book in the single night panel — **cover** (recurring-character art keyed to the chosen companion + title + "for [name], age [x]" + Begin →), **even story pages**, **CTA as the final page**. Navigation: Back/Next + page-dots + arrow keys + **mobile swipe** (45px threshold). Auto-scrolls the panel into view on generate (mobile).
  - **Sentence-aware paginator:** splits over-long paragraphs at sentence boundaries (never mid-sentence) so pages come out even instead of a few fat 200-word walls. **Page density tuned 110 → 85 words** (`paginate` default `target`; hardMax auto = target × 1.4 ≈ 119) so pages read lighter, more like a picture book — a couple more page-turns, dots show progress. Knob lives at `function paginate(body, target = 85)` in `Demo.tsx`; 85→70 lightens further, 85→95 splits the difference.
  - **Paragraph spacing:** story-page render changed from one `whitespace-pre-wrap` `<p>` to a `space-y-4` `<div>` mapping `pages[storyIndex].split(/\n\s*\n/)` into one `<p className="m-0">` per paragraph. Gives real gaps between paragraphs *when a page holds more than one*. **Reality check (accepted as-is):** the paginator is pure text-math (never reads screen width), so a given story renders identically on desktop and mobile — paragraph-break *variance* is per-story (long paragraphs fill a page alone → no gap; short ones pair up → gap; the ~6-word "Goodnight…" line almost always pairs with the final paragraph, so that gap shows on nearly every story). SD: **"live with it for now."** Making breaks *reliable* is a prompt change (write shorter paragraphs), not CSS — **PARKED for the next engine pass** (§4/§7).
  - **Repo hygiene (the long-standing `.gitignore` TODO — DONE):** added `.DS_Store` + `*.tsbuildinfo` to `.gitignore`, then `git rm --cached` un-tracked the three committed `.DS_Store` files (root + `src/` + `src/app/`) and the `tsconfig.tsbuildinfo` build cache. `git ls-files | grep` confirms none still tracked. Committed to `main` alongside the storybook work. *(Pure version-control hygiene — Wrangler had already shipped all the code live; the commit just banks it.)*
  - **Fixed-frame panel (the recurring resize bug, finally fixed):** panel is a fixed **600px** card with a `min-h-0` → `overflow-y-auto` scroll chain, so a long page scrolls *inside* the frame rather than stretching it. Grid changed `md:items-stretch` → `md:items-start` so the panel no longer chases the tall form's height (which was pushing the footer off-screen). Top-aligned beside the form, footer always in frame.
  - **Spacing + eyebrow:** `#try` top padding `py-[74px]` → `pt-6 pb-[74px]` (killed the big cream band on landing); **"SEE THE MAGIC FIRST" eyebrow removed** from the try section only (made `SectionHead` eyebrow optional; Pricing/FAQ keep theirs).
  - **Story length:** words/min 130→150 in `prompt.ts`; demo default length 5→3 min.
  - **⭐ ALL FIVE GO-LIVE GATES CLEARED (SD, 29 Jun):** PwC outside-business-activity disclosure (no conflicts — was the hard gate), entity (starting in Newforge Advisory Partners LLC), COPPA, ToS governing-law. **Only the mechanical Stripe live switch (GL-1) remains.**

### 🔴 NOW (next session)
1. **GL-1 Stripe go-live — WAITING ON STRIPE REVIEW, then the real-card test.** Everything on our side is done & deployed (live products/prices, webhook, 7 env vars — see header + §11). When the "Review in progress (2–3 days)" banner clears: run **ONE real-card subscription** and **watch it like a hawk** — confirm (a) the charge succeeds AND (b) a `subscriptions` row actually lands in Neon (the webhook write is what flips `getAccess()`, separate from the payment). This is also where the API-version mismatch (code `2024-06-20` vs webhook `2026-06-24.dahlia`) gets proven; if the row doesn't write, that's the first suspect. Until this passes, NOT taking real money.
2. **⭐ Reviewer access-code generator (the productive use of the review window).** Build while Stripe reviews, to get real families into the product gathering beta feedback. Requirements captured (see new §16). Principle: a code grants the same `getAccess() = true` a paid sub grants, via a SEPARATE path — never fake Stripe subscriptions (keeps the live account clean for review). Forces finally building `/admin/dashboard/page.tsx` (only `/api/admin/metrics` exists today; the Access wall points at a missing page). **Security non-negotiable:** the mint-code API route must be server-side behind Cloudflare Access, not just the page — an unprotected mint endpoint is a free-subscription faucet.
3. **Test the episodic memory loop** — generate 2–3 stories for one child, confirm continuity + anti-repetition actually fire. Built but never user-tested.
4. **Mobile login gap (from UX-4) — same-day fast-follow once live.** A returning parent on a phone currently can't log in (the whole `<nav>` is `md:flex` hidden); nav anchors are bare `#world/#how/#pricing` that break on sub-pages (need `/`-prefix). Doesn't block first signup, but bites the first returning user.
5. **Decide the `/waitlist` orphan family** — `/start` + `/waitlist` are already safe `redirect("/")` pages; `Waitlist.tsx` + `/api/waitlist/route.ts` already gone; the `waitlist` DB table STAYS (`/api/admin/metrics` queries it). Resolved as handled-via-redirect (HK-7 done); deleting the redirects would regress old links to 404s. Effectively closed — kept here only as a pointer.

### 🟠 NEXT (refinements — none blocking)
4. **Demo generation latency (the wrapper, not the model).** Measured 29 Jun: the model call is ~8.4s for ~455 words (stable) — NOT the ~20s felt. The felt latency is the route wrapper (two rate-limit DB queries + Neon round-trips + usage insert + edge cold-start) + client round-trip + pagination render. Optimise the wrapper next: combine/defer the rate-limit queries, address cold-start, consider streaming. Real engineering, own session. (Sonnet→Haiku via `STORY_MODEL` env only trimmed the smaller half — decide keep-Haiku-vs-revert-Sonnet on demo *quality*, not speed.)
5. **P2 polish:** surface privacy/trust higher (hero/demo one-liner; expand privacy FAQ) · full accessibility pass (demo chips as real inputs, keyboard nav, WCAG AA contrast) · **mobile "bedtime" pass** (one-handed, dark, large tap targets — the 7:58pm context).
6. **Email verification on signup** (Better Auth `sendVerificationEmail` via Resend — ready).
7. **Friendlier 429 message (OPS-3) + tune the rate limit (OPS-4).** Demo limit raised 5→20/hr, authed 10→30/hr this session; "storyteller nodded off" copy is the 429 — make it clearly a rate-limit message, and tune the 20 number on real traffic.

### 🟡 LATER (the product engine — in dependency order)
6. **⭐ Serialized two-part stories (calm cliffhanger)** — Part 1 lands the child asleep, Part 2 tomorrow. Built on memory. The signature long-form feature. NOT a length hack, NOT a tonight thing.
7. **Richer engine, profile-driven** — per-year age scaling, stakes-that-resolve, co-star mode, interest→premise, now persistent & profile-driven (incl. age-scaled portrayal of the shared cast §10). Partly in the demo; the profile-driven version is pending.
8. **Durable/semantic memory (the "growth" layer)** — §12. Periodic distillation of full history into an evolving portrait that re-distills (so traits fade, not just accumulate). Where character/child *aging* lives.
9. **Nightly delivery** — scheduled generation before bedtime · offline pre-load · rejection fallback · Resend email + in-app library · **morning** feedback loop ("how was last night's?" — never at bedtime).
10. **Audio narration** — warm default voice with **correct name pronunciation** (critical); later flagship **"read in your voice"** (recorded/cloned; emotionally huge, ethically heavy).

### ⚪ SOMEDAY
11. **Keepsake books** — monthly printed, illustrated compile. Then a **Keepsake tier** can return — differentiated by household size + premium features, never by story quality.
- **Additive companion unlocks (§10 Growing Cast)** — new friends join the circle at age/relationship milestones (a gain of growing up, never a swap-out).
- **Gifting** = a `gift_codes` table (code exists in the gap before signup; recipient redeems → plan attaches to their `user.id`).
- **"Continue the story" button — demo only** (NEVER in the bedtime product — engagement pattern, against the disengagement ethic).
- **Long-form as a "weekend special" mode** rather than a nightly dial.

### 🛡️ Operational maturity (not yet started — needed before/around real-money go-live)
*None of these exist in the codebase yet. Flagged so they're not forgotten when the funnel goes live.*
- **Children's-data / privacy compliance (COPPA & similar).** A children's product taking payments and storing child profiles has real regulatory obligations (parental-consent model, data-retention/deletion, what's stored about a minor). Arguably a bigger go-live gate than the ToS governing-law clause. Confirm scope with counsel alongside the §11d entity/PwC question.
- **Conversion analytics / funnel instrumentation.** The demo→signup→subscribe funnel was just built but is **not measured**. Without it there's no way to know if it converts (or where it leaks). Add privacy-respecting analytics (self-hosted/cookieless preferred for a trust-brand) before/with go-live.
- **Stripe lifecycle emails (dunning).** Beyond the welcome email: trial-ending reminder, payment-failed/retry (dunning), cancellation confirmation. Driven off Stripe webhook events + Resend. Directly protects revenue.
- **Error monitoring / observability.** No Sentry-equivalent today. For a paid product, silent generation failures or webhook errors in production need to surface. Add before real customers depend on nightly delivery.

### 🧹 Ongoing polish / housekeeping
- Welcome email on signup · "Tonight's friend: Waverley" caption after a demo story · swap stylized founder photo for a real one · **governing-law clause in ToS reviewed by counsel before charging real money** (risk consciously accepted for test-mode beta).
- **Clean up (see §15 for the verified list):** orphaned `/start` + `/waitlist` pages + `/api/waitlist` + `Waitlist.tsx` (dead after the waitlist removal — `/start` actively dead-ends parents) · admin dashboard *page* not built (only its API) · delete `diag_%` test users from Neon · ✅ `.DS_Store` + `tsbuildinfo` gitignored & untracked (DONE 29 Jun).
- **Open question — `weekly_theme` DB column:** present on `children` (§6) but not surfaced as a feature anywhere. Decide if it's planned (a themed-week mode) or vestigial.

---

## 2. Guiding principles (these veto or reshape features)
- **Two users, one buyer.** Parent buys & operates; child experiences. Conflict → parent ease wins operationally, child wonder wins in the story.
- **The 7:58pm test.** Works flawlessly in 10 seconds, one-handed, in the dark, with a tired parent and a wired kid. Vetoes login walls, spinners, fiddly players at bedtime. *(Drove the Cloudflare Access re-scope: a parent must never hit a wall at `/dashboard`.)*
- **Reliability beats brilliance.** The ritual must fire every night. **Corollary: a story must never cut off mid-sentence.** ✅ enforced.
- **Slightly-wrong personalization is worse than less.** Name pronunciation, age match, known details. Protect "that's ME."
- **Marketing must be honest to the shipped product.** Same prices, features, and path everywhere. For a trust-brand, alignment IS the design work. (Drove the P0 rebuild.)
- **Progressive personalization.** Structured baseline + optional rich free-text + deepens via memory. Profile = a living portrait, not a one-time form.
- **"Remembers" is a retention engine** (anticipation + switching cost), not just delight.
- **The relationship deepens, never resets.** The cast a child grows up with is shared and continuous — characters portrayed differently as the child ages and new friends *added* at milestones, but the circle is never swapped out. Continuity is the asset. (See §10.)
- **One identity.** Memory = identity = the product, so exactly one notion of "parent": the auth `user`. (Realized in the §9a migration.)
- **Failing closed is correct.** `getAccess()` denies on any lookup error — never grant access on a fault.
- **Don't buy ads before retention is proven.** The most expensive mistake would be paid acquisition before a beta proves 3–4 month retention.
- **Success = the child disengaging.** No engagement dark patterns — no autoplay-next, no streaks, no urgency/scarcity. The honesty framing ("No charge today") is the trust-brand version of risk-reduction. Marketing asset: "the only app designed to make your child stop using it."
- **Trust must be visible & repeated.** AI + kids = anxious parents; trust is the growth strategy.
- **The narrated voice IS the product at bedtime.**
- **Households, not single children.** Multi-child, multi-caregiver; the sibling *dynamic* is itself a field.
- **Bedtime is off-grid.** Tonight's story pre-loaded & available offline.

---

## 3. Deploy & build discipline (hard-won — read before deploying)
- **Deploy method = Wrangler direct, always:**
  `npx @cloudflare/next-on-pages && npx wrangler pages deploy .vercel/output/static --project-name=lullawood`
  Cloudflare's **git-integration build pipeline is broken** (content-free "internal error" *before* building; not on their status page; survives build-system v2/v3 + retries — confirmed Cloudflare-side). Build config is correct. **Auto-deploy noise:** pushing to GitHub triggers a failing Cloudflare build — ignore the red mark; the commit still banks the work; Wrangler is the real deploy.
- **Transient `fetch failed`** on the Wrangler upload finalize is a known blip — answer `n` to the report prompt and re-run the `wrangler pages deploy` line alone (no rebuild).
- **Always run BOTH** `next build` AND `npx @cloudflare/next-on-pages` before deploying — the second catches edge-runtime errors the first misses.
- **Verify before deploy:** for risky edits, grep the file (tag counts, key strings) and confirm a clean `next build` *before* pushing. Don't deploy on "looks done."
- **Verify DB end-state with a follow-up SELECT** — Neon's SQL editor shows only the last statement's result; a mid-block failure scrolls past.

### 3a. The file-transfer gremlin (cost real time — READ)
Pasting code into the editor through the chat **repeatedly dropped standalone `<a` opening-tag lines**, leaving orphaned `href=` and "JSX expressions must have one parent element" / "Unexpected token" build errors. Pattern: every `href=` must have `<a` on the line directly above it.
- **After any paste with links:** Cmd+F `href=` → confirm each has `<a` above it. Type the missing `<a` by hand (the chat itself mangles that exact token).
- **A machine freeze can silently drop lines** mid-file (this session: lost the `{!story && ...}` wrapper + an outer `</div>`, cascading errors). After any freeze, **re-verify the file compiles**; read the *actual* build error and fix the named line — don't guess.
- Full-file replacements (Cmd+A, delete, paste) are safer than surgical multi-line edits for complex JSX; type-check on the assistant side before handing over.
- **Earlier-observed macOS failure modes (pre-VS Code), kept for reference:** long single-line terminal pastes truncate → stuck zsh `quote>`/`cmdand` (Ctrl-C to escape); `cat << 'EOF'` heredocs snag → stuck `heredoc>` (Ctrl-C/Ctrl-D); TextEdit silently drops `<a`-only lines AND defaults to rich text/`.txt` (Format → Make Plain Text; force the extension); `pbpaste` works only if the command is *typed* (copying it overwrites the clipboard); chunked base64 (`base64 -D -i file > dest`) never corrupted but is slow (macOS decode flag is `-D` + needs `-i file`); perl/sed one-liners with backticks fight zsh — match on a backtick-free part of the line.

**⭐ The stale-download trap (29 Jun — cost ~5 wasted deploy cycles). READ.** When the assistant "presents"/shares a file, it does **NOT** auto-save to `~/Downloads` — the human must actually click to download. And a repeat Chrome download of the same name **appends `" (1)"`** instead of overwriting. Net effect: `cp ~/Downloads/Demo.tsx ...` silently kept copying an **hours-old stale file** while five real fixes piled up unused/under-clicked. The UI looked unchanged after every "deploy," and we mis-diagnosed it as a code bug five times.
- **PROTOCOL — verify bytes on disk before every deploy.** After any file change, confirm the file in the repo actually contains the change: `grep -c` for 2–3 expected markers + `wc -l` + (ideally) `md5`. Only deploy when those match. Never trust "I copied it."
- **Prefer edits that can't go stale:** in-place `perl`/`node -e` against the repo file, or **Claude Code direct-write** (SD is in the VS Code extension — this is exactly its job and removes clipboard/Downloads from the loop entirely).
- **For terminal edits with template literals (backticks) or JSX braces:** heredocs and clipboard pastes mangle them. Use `node -e` with the content inlined, or `perl` with a **balanced delimiter that isn't `{}`** (e.g. `s|...|...|`). Then run `npx tsc --noEmit -p .` — let the compiler, not the eye, certify the JSX is balanced.

---

## 4. Pricing, COGS & tiering (finalized)
- **Launch pricing (locked):** Dreamer $8.99/mo · $89.99/yr (1 child) · Family $12.99/mo · $129.99/yr (up to 4 kids). 7-day trial. "2 months free" annual story (~17%).
- **COGS ≈ 3.2¢/story** (Sonnet 4.6 story + Haiku 4.5 summary, system prompt cached). Per subscriber/month roughly: 1 child ~$0.47–0.95; 4 kids nightly ~$3.79. **COGS does not constrain pricing.** Margins healthy (66–90%); Family margin compresses with kid count by design, ~4-child cap protects it.
- **Stripe fee (2.9% + $0.30) rivals model COGS at these prices** → strong argument for annual plans.
- **Keepsake tier deferred** until audio + printed books exist. Differentiate tiers by **household size + additive premium features, never by story quality.**
- **Real risks are CAC + churn, not COGS.** Audio (future) will multiply COGS.
- **⚠️ There is NO warm waitlist.** The waitlist table had zero people and is now removed. Acquisition is from scratch — the real challenge. Price on judgment; validate with the first real signups.

---

## 5. Input architecture (how personalization is captured)
The core insight: **with an LLM behind it, natural language is the infinite-variable interface.** Don't widen the form with dozens of controls — deepen the profile and open a text box. Governing rule: **structured inputs for what must be exact & guaranteed** (name spelling → pronunciation, age → tuning, the avoid-list); **free text for what is rich & unbounded** (premise, personalities, dynamic, tonight's twist).

**Two layers, two moments:**
- **PROFILE layer** — set once, deepens over time. Entered in a calm daytime moment, so it can be rich. The durable truths (see §6).
- **TONIGHT layer** — fast, optional, per-night. Defaults to *empty*: with a good profile the system produces a great story with **zero** nightly input (one tap). The nightly box is only for what's *different* tonight.

**Nightly input methods (build toward these):**
- **Free-text "describe your own adventure"** ✅ shipped (precedence over chips; safety binds on top).
- **Chips pre-fill the text box** (accelerators, not a separate path) — tap "Football" → seeds editable text.
- **Voice input** — a tired parent *speaks* the request more easily than typing in the dark. High value at bedtime.
- **"Like last night, but…"** — reuse the previous story as a starting point (also a memory feature).
- **Day-processing prompt** — optional "anything happen today?" that metabolizes the child's real day (first day of school, lost tooth, hard moment). A killer, hard-to-copy feature.
- **Reading-time estimate shown before generating** — so a parent with 4 minutes doesn't get a 9-minute story.

**How the LLM uses it:** free text is slotted into the prompt as a labelled block; the model conditions on it alongside the constant system scaffold (craft, age-tuning, safety, wind-down). **Nothing is remembered unless we extract & save it** → durable stuff lives in the profile; the nightly box is only the *delta*.

---

## 6. The variable inventory (what a rich profile can hold)
Most of these are profile richness the engine *mines*, NOT visible form fields. A handful stay structured because they must be exact.
- **The child:** name (spelling → pronunciation), exact age, appearance, personality, comfort items, **fears / "never include" avoid-list** (structured — now `avoid_list` in DB ✅).
- **Their world:** specific interests (not "football" but "plays goalkeeper for the under-9s, supports Liverpool"), loves, inside jokes, location. *(Free-text mined from `about_text` ✅.)*
- **The cast:** siblings, friends, pets, grandparents — **by name** — plus the **sibling dynamic** (how they tease / get along). *Upstream data for the Growing Cast (§10).*
- **Tonight:** premise, mood, a value/lesson to weave in (never preachy).
- **Constraints:** length (→ §1 length default), reading level, intensity, language, cultural/faith considerations.

**DB columns present on `children`:** `name`, `age`, `animals`, `colors`, `interests`, `about_text` ✅, `avoid_list` ✅, `weekly_theme`, `bedtime_hour`, `timezone`, `recurring_characters`, `active`. *(Cast-relationship/sibling-dynamic fields still TODO when the form grows.)*

---

## 7. Architectural truth
**Memory = identity = the product.** Children hang off the auth `user.id` (one-identity migration, §9a); the standalone `parents` table is gone. `subscriptions` table keyed to `user.id` is Stripe's truth, written **only by the webhook**. Story schema (`children`, `stories.summary`, `recurring_characters`) + generator (`previousAdventures`, `recurringCharacters`) are memory-ready; episodic loop is live, durable/semantic layer is §12.

---

## 8. End-state vision & parent journey
**Finished state:** a subscription giving each child a new personalized bedtime story every night — starring them (+ optional sibling), consistent world, recurring friends, tuned to exact age, that **remembers and builds night-to-night**, delivered as text + warm narrated audio, optional monthly printed keepsake.

**Parent journey:** Discovery → Commitment (low-risk trial) → Onboarding (progressive personalization) → **First story (make-or-break: must exceed the demo)** → Nightly ritual (effortless, dark-proof) → Deepening (memory makes it more *theirs*) → Belonging / advocacy (keepsake + library + referral).

**Retention spine:** cue (bedtime) → routine (tonight's story is *there*) → reward (child delighted, parent relieved) → **deepening** (memory makes tomorrow better than today). Never break the chain.

---

## 9. Build phases (detail behind §1)
- **Phase 1 — Auth.** Better Auth (edge) + Neon. ✅ Signup, login, logout, sessions, **password reset** LIVE. **Remaining:** email verification on signup.
- **Phase 2 — Child profiles.** §5 input architecture + §6 inventory. ✅ LIVE: one-identity schema, profile API, dashboard, **add-a-child form, single-child view**. **Remaining:** cast-relationship/sibling-dynamic fields as the form grows.
- **Phase 3 — Memory loop.** ✅ Episodic LIVE (save summary; retrieve into next prompt; anti-repetition) — untested. Durable/semantic = §12, later.
- **Phase 4 — Richer engine.** Per-year age scaling; stakes-that-resolve; co-star; interest→premise; age-scaled shared cast (§10). Partly in the demo; profile-driven version pending.
- **Phase 4.5 — ⭐ Serialized two-part stories.** Calm cliffhanger; Part 1 lands the child asleep, Part 2 continues tomorrow. On memory.
- **Phase 5 — Stripe.** ✅ LIVE IN TEST MODE (subscriptions, trial, gating, child-cap, billing portal). Billing identity = `subscriptions` keyed to `user.id`; gifting = `gift_codes`. **Remaining: go-live** (entity/PwC gate + live keys/webhook/products — §11).
- **Phase 6 — Nightly delivery.** Scheduled, offline pre-load, fallback, email + library, morning feedback.
- **Phase 7 — Audio.** Warm default + correct pronunciation; later "read in your voice."
- **Phase 8 — Keepsake books.**

---

## 10. Design notes & QA watches
- **Character naming:** the demo's companion button stays a plain scannable word ("Bear", "Lion"); the *story* uses the character's name ("Bramble", "Linden"). Confirmed working.
- **Naming-collision watch:** the son **Leo** vs. the **Lion** character (Linden) — never call a lion "Leo". Watch any case where a child's name collides with a character/species.
- **No-markdown rule:** stories must be plain prose. ✅ shipped.
- **Token floor:** output cap (now 2400) must fit the longest chosen length *with* its ending. ✅ raised.
- **Demo example matches the form's default state** (age 6, Fox, Ocean) — a deliberate "these inputs → this story" teaching device.

---

## 11. Auth & Stripe implementation notes (so we never re-debug this)
**Auth:**
- **Stack:** Better Auth ^1.6 + Drizzle adapter (`provider: "pg"`) + Neon HTTP driver, Cloudflare Pages **edge**. (Edge works — the "must migrate to OpenNext" panic was WRONG.)
- **Per-request instance:** auth built inside `getAuth()` (mirrors `getDb()`) — on the edge `process.env` is only populated per-request. Never construct at module load.
- **THE BUG that cost the auth session:** the Drizzle adapter does NOT auto-discover tables; pass the schema object explicitly (`drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } })`). Else: `The model "user" was not found in the schema object.`
- **DB columns are quoted camelCase** (`"emailVerified"`, `"userId"`, …). Tables created via raw SQL in Neon.
- **Env vars (Cloudflare → Variables, Production):** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://lullawood.com`, `RESEND_API_KEY`, plus the **seven Stripe vars** (below). Env changes need a fresh deploy.
- **Server session:** `src/lib/session.ts` → `getSessionUser(headers)` wraps `auth.api.getSession({ headers })`. The one place server code resolves identity. **Never trust a `parentId` from the browser — derive it here.**
- **Reset password:** `sendResetPassword` in `auth.ts` via Resend from `Lullawood <noreply@lullawood.com>`. Client `requestPasswordReset` / `resetPassword` in `auth-client.ts`. `/reset-password` reads token via `useSearchParams` and **must keep its `<Suspense>` wrapper** (Next 15 build fails without it).
- **Debugging lesson:** on a Workers 500 with empty body, build a **diagnostic GET route that returns 200 with the real error** and performs the failing op server-side. **Diagnose the real error before changing architecture.**
- **Files:** `src/lib/auth.ts`, `auth-schema.ts`, `auth-client.ts`, `session.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/signup|login|forgot-password|reset-password|dashboard/page.tsx`.

### 11a. The one-identity migration
- **Why:** there were *two* parent identities — auth `user` and a legacy `parents` table — and `children.parentId` pointed at `parents.id`, which a logged-in user never had a row in. **Chose Option A:** children hang off `user.id`.
- **Gotcha:** `user.id` is **`text`** but `children.parent_id` was **`uuid`** — convert the column type, not just re-point.
- **Real-name gotcha:** the old FK was `children_parent_id_fkey` (Postgres default), NOT Drizzle's `children_parent_id_parents_id_fk` convention. `DROP CONSTRAINT IF EXISTS` on the wrong name silently skips and blocks the type change. Look up the real name: `SELECT conname FROM pg_constraint WHERE conrelid='children'::regclass AND contype='f';`
- **Neon SQL editor shows only the last result** — verify end-state with a follow-up `SELECT`, never trust "it ran."
- **Final migration (in pieces):** drop `children_parent_id_fkey` → `ALTER COLUMN parent_id TYPE text` → add FK to `"user"(id)` → add `about_text`, `avoid_list` → `DROP TABLE parents`.
- **schema.ts:** `children.parentId` is now `text(...).references(() => user.id ...)`; `user` is **re-exported from `schema.ts`** (`export { user }`) so `getDb()`'s `import * as schema` sees it and the relation resolves in one Drizzle instance.

### 11b. Stripe / webhook edge gotchas
- **Webhook signature verify must use `constructEventAsync`** (NOT `constructEvent` — the sync version uses Node crypto and fails on edge).
- Subscription state is **Stripe's truth, written only by the webhook**, upserted to `subscriptions` keyed to `userId` (recovered from checkout-session metadata). Webhook returns 500 on transient errors to trigger Stripe retry.
- Checkout route: session-derived parent → find-or-create Stripe customer (userId in metadata) → subscription Checkout with 7-day trial + `allow_promotion_codes`, success_url `/dashboard?welcome=1`.
- `getAccess(userId)` in `src/lib/subscription.ts`: status `trialing|active` = access; returns plan + `maxChildren` (Dreamer 1 / Family 4); **fails closed**.
- **Stripe billing portal must be activated** in the Stripe Dashboard (Settings → Billing → Customer portal: enable Cancel + payment-method updates) for `/api/billing-portal` to work. Done in test mode.

### 11c. Stripe env vars (test mode)
`STRIPE_SECRET_KEY` (secret), `STRIPE_WEBHOOK_SECRET` (secret), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_DREAMER_MONTHLY`, `STRIPE_PRICE_DREAMER_YEARLY`, `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY`. In `.env.local` (gitignored via `.env*.local`) and Cloudflare Production. **At go-live: regenerate all as LIVE keys, re-create products/prices in live mode, register a live webhook endpoint, swap in Cloudflare.**

### 11d. Business entity & PwC gate (BLOCKS real-money go-live)
SD has a registered LLC, **Newforge Advisory Partners LLC** (PwC-adjacent advisory work). Go-live forces a decision. Considerations (not legal advice — confirm with accountant/attorney + PwC ethics):
- **PwC outside-business-activity / independence disclosure is the hard gate** — a consumer SaaS taking payments + holding children's data very likely requires disclosure and possibly pre-clearance, *regardless of entity*. Resolve first.
- **Liability separation argues for a dedicated Lullawood LLC** rather than running a children's-data payments business through the advisory entity.
- **Umbrella only protects if subsidiaries are separate legal entities** (holding-co over a Lullawood LLC) or a state-recognized Series LLC — a bare DBA under Newforge gives no separation.
- Stripe onboards one legal entity (EIN + bank account); that choice *is* the liability decision.
- **Test-mode beta needs none of this** — fully usable for invited families with no real charges, so this gates only the real-money switch, not continued building/testing.

---

## 12. Memory layers (episodic vs durable)
- **Episodic (LIVE):** "what happened" — rolling window of the last ~6 story summaries → continuity + anti-repetition. The necessary substrate.
- **Durable / semantic (LATER):** "what's true now" — periodic **distillation** of full history into an evolving portrait that **re-distills**, so traits *fade* rather than only accumulate (avoid ossifying "loves dinosaurs forever"). Where child/character **growth & aging** live. Marked with a `LULLAWOOD-FUTURE` block at the top of the generate-story route.

---

## 13. The Growing Cast (product direction)
The cast a child grows up with should **deepen, never reset.** Trigger: Bramble the Bear reads beautifully for a 4-year-old but may feel too soft for a 9-year-old — which tempts an age-segmented, swap-out cast. That temptation is rejected.

**Why NOT age-segmented (swap-out) casts:**
1. **It breaks continuity — and continuity is the retention engine.** The accumulated world/library is the switching cost and the reason to return.
2. **It risks "slightly-wrong personalization."** A child who loves a character and finds them suddenly gone notices the wrongness.
3. **It can't serve multi-child households.** Siblings of different ages share a world and co-star together.

**The two mechanisms we build instead** (both fold into the existing prompt scaffold + profiles):
- **(a) Age-scaled portrayal of the *same* shared cast.** Same characters; register/vocabulary/stakes shift by the child's exact age. *Folds into Phase 4.*
- **(b) Additive companion unlocks.** New friends *join* the circle at age/relationship milestones — a gain of growing up, never a replacement. *Sits in §1 SOMEDAY until profiles + memory make milestones legible.*

**Upstream data requirement:** named-relationship and cast fields baked into **child profiles from Phase 2** so the engine knows who's already in the circle.

**Open questions:** what triggers an unlock (age / story count / explicit parent action)? how many friends before the circle feels crowded? per-child or per-household unlocks?

---

## 14. Changelog
- **30 Jun 2026 · 11:40 PT:** **⭐ GL-1 Stripe go-live FULLY STAGED (pending Stripe's account review) + pricing validated + strategy docs added.** Walked the entire live switch end-to-end, terminal/dashboard, one verified step at a time: (1) live account **activated** — category "Software as a service", honest description, legal entity **Newforge Advisory Partners LLC**, public/DBA name **Lullawood**; (2) **products + prices copied from sandbox → live** (Dreamer $8.99/$89.99, Family $12.99/$129.99 — verified amounts + monthly/yearly split; live IDs all carry account fragment `FJUf3Z1GL0`, old test IDs were `Uph3N7d64` — caught + overwritten); (3) **live webhook** registered at `https://lullawood.com/api/stripe/webhook`, "Your account" scope, snapshot payload, **3 events matching the handler** (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` — confirmed via grep; deliberately NOT `.created`, which the handler ignores); (4) created a **Full-access live secret key**; (5) all **7 env vars** set in Cloudflare Production (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` marked **encrypted**), the four price IDs overwritten with live values; (6) **deployed green**; `curl /api/checkout` → **405** (healthy — route loads, rejects GET). **Trial is set in code (`trial_period_days`), NOT on the price** — so "No trials" in the dashboard is correct. **The only thing left is Stripe's own review ("2–3 days") + ONE real-card test** — not in our control. **⚠️ API-version mismatch noted** (code pins `2024-06-20`; live webhook on account default `2026-06-24.dahlia`; dropdown wouldn't offer the older version) — judged low-risk (core subscription fields stable) but **must be verified at the real-card test** (watch for the `subscriptions` row write). **OPS-1 (diag route) DONE** (deleted + verified 404). **Stripe MCP connector** OAuth-connected but tools wouldn't load into session → used the **dashboard directly** for products (also safer: eyes on the live/test toggle on the money path). **Pricing deep-dive (acting as Head of Marketing, ~10 web searches, all validated):** launch prices **$8.99/$12.99 confirmed market-correct** (low end of the $10–30 personalization band; near-identical $9/mo competitor at ~900 subs/~$8k/mo). **Rejected SD's "gate memory at T2" idea** — memory is the differentiator + retention moat; never gate the core/expected/retention feature (RevenueCat 2026: AI apps +41% rev/payer but churn 30% faster; memory is the antidote). Auto-delivery = a MID-tier convenience (a competitor auto-emails at $9), NOT a top-tier feature; reserve T3 for audio + printed keepsake books ($19–25). Real weakness = tiers gate only on #children (single-child homes never upgrade) → fix post-launch with convenience + premium triggers. **Don't delay launch to re-architect.** Two new repo docs committed (`5f430e9`): **`PRODUCT-SHEET.md`** (tiers + competitor comparison chart) + **`MARKETING-STRATEGY.md`** (tier upgrade triggers + conversion playbook + sources). **Tier strategy PARKED for post-launch** (revisit with real funnel data). **Reviewer access-code generator** requirements captured (new §16) as the productive use of the review window.
- **29 Jun 2026 · 22:00 PT (later):** **Storybook polish — paragraph spacing + lighter pages — and repo hygiene.** Story-page render now maps `\n\n`-split paragraphs into separate `<p>`s in a `space-y-4` div (real gaps where a page holds >1 paragraph). Tuned **page density 110 → 85 words/page** (`paginate` `target`) so pages read lighter, more like a picture book. **Resolved the desktop-vs-mobile "no breaks on mobile" question:** the paginator is pure text-math (never reads screen width) → identical pages every device; the break *variance* is per-story (long paragraphs fill a page alone → no gap), and the ~6-word "Goodnight…" line almost always pairs with the final paragraph so that gap shows on nearly every story. SD accepted **"live with it for now"**; reliable breaks = a *prompt* change (shorter paragraphs), **PARKED** for the next engine pass. **Verify-bytes protocol worked this time** — `grep -c "space-y-4"` confirmed the prior fix was actually on disk *before* deploying, no stale-file repeat. **Repo hygiene (the long-standing TODO — DONE):** `.gitignore` now ignores `.DS_Store` + `*.tsbuildinfo`; `git rm --cached` un-tracked three committed `.DS_Store` files + the build cache; confirmed clean via `git ls-files`; committed to `main` with the storybook work. **Surfaced a new orphan:** `src/app/waitlist/page.tsx` (a live `/waitlist` page, dead since the waitlist removal) appeared as a new file in the commit — added to the §15 cleanup family (`/start` + `/waitlist` + `/api/waitlist` + `Waitlist.tsx`). **Stripe live (GL-1) deliberately NOT flipped tonight** (fresh-head job); **diag route (OPS-1) still live** — both head the NOW list.
- **29 Jun 2026 · 21:10 PT:** **Storybook demo reader + all five go-live gates cleared.** Demo story now renders as a paged page-turn **storybook** (cover → even ~110-word pages → CTA; Back/Next + dots + arrow keys + mobile swipe). Built a **sentence-aware paginator** (splits long paragraphs at sentence ends — never mid-sentence). Fixed the **recurring panel-resize bug** for real: fixed **600px** panel + `min-h-0`/`overflow-y-auto` scroll chain so long pages scroll *inside* the frame; grid `md:items-stretch` → `md:items-start` so the panel stops chasing the tall form's height (which was shoving the footer off-screen). Trimmed `#try` top padding and **removed the "SEE THE MAGIC FIRST" eyebrow** (made `SectionHead` eyebrow optional). Story words/min 130→150; demo default length 5→3 min. **All four judgment gates CLEARED on SD sign-off** (PwC disclosure / entity = Newforge Advisory / COPPA / ToS) — **GL-1 Stripe live switch is the lone remaining step, scheduled this evening.**
  - **Latency finding:** measured via a temp `/api/diag-model` route — the model call is **~8.4s for ~455 words** (stable across 3 runs), NOT the ~20s felt. The model was never the bottleneck; the felt latency is the **route wrapper** (rate-limit DB queries + Neon round-trips + usage insert + edge cold-start) + client round-trip + pagination render. Optimise the wrapper next session. The Sonnet→Haiku swap (`STORY_MODEL` env) only trimmed the smaller half. **⚠️ The temp diag route is live, unauthenticated, and billable — delete it (OPS-1) in the next deploy.**
  - **🛠️ HARD LESSON — file delivery (§3a):** spent ~5 deploy cycles "fixing" `Demo.tsx` with zero visible effect because **`present_files` does NOT auto-download to `~/Downloads`**, and a repeat Chrome download appends `" (1)"` rather than overwriting — so `cp ~/Downloads/Demo.tsx` kept copying a stale file. **PROTOCOL going forward:** after any file change, **verify the bytes on disk** (grep for expected markers + line count + md5) BEFORE deploying; prefer **in-place edits** (balanced-delimiter `perl`, or `node -e` with content inlined) or **Claude Code direct-write** over the clipboard/Downloads path; let `tsc --noEmit` be the final arbiter of JSX validity. Terminal heredocs/pastes mangle backticks + braces — avoid them for code with template literals.
- **28 Jun 2026 · 20:50 PT (later):** **Repo route audit + roadmap made representative of actual code.** Scanned `src/app` directly: confirmed all claimed pages/APIs exist; added **§15 route inventory** (ground truth). Found orphaned/contradicting code — **`/start`** (old pre-Stripe onboarding wizard that dead-ends parents into the removed waitlist), **`/api/waitlist` + `Waitlist.tsx`** (dead after waitlist removal), and **`/api/admin/metrics` without an `/admin/dashboard` page** (Access wall points at a non-existent page). Added an **Operational maturity** block (COPPA/children's-data compliance, funnel analytics, Stripe dunning emails, error monitoring) — none existed in the roadmap and all matter around go-live. Also reinstated §5 input architecture + §6 variable inventory that a first-pass rewrite had dropped.
- **28 Jun 2026 · 20:50 PT:** **Conversion funnel rebuild + full Stripe monetization (test mode).** Stripe pipe proven end-to-end (pricing→checkout→webhook→DB), gating, child-cap, billing-portal/cancel all live. Marketing made honest (real prices, Keepsake removed, audio "coming soon", waitlist removed, CTAs→signup). Conversion spine demo→signup→child→pricing with name+age+animal carry-through. Demo simplified (More-options toggle) + age placeholder + personalized example story. Polish: CTA upgrade w/ reduced-motion, humanized email errors, warmed forms (brand mark + trust line), **Log-in nav link** (was outstanding). Captured: Cloudflare git-build is broken (Wrangler-direct is the deploy), the `<a`-drop file-transfer gremlin + freeze-recovery (§3a), pricing/COGS finalized (§4), **no warm waitlist exists**, episodic-vs-durable memory (§12), and the **entity/PwC gate** on real-money go-live (§11d).
- **27 Jun 2026 · 13:40 PT:** Password reset LIVE & tested (Resend, domain verified). Cloudflare Access re-scoped off `/dashboard` → `/admin/dashboard`. Phase 2 foundation: one-identity migration (§11a), secure `/api/profile` + `getSessionUser()`, parent dashboard. Decided Option A (one identity).
- **27 Jun 2026 · 11:50 PT:** Added date+time stamp convention. Restored Growing Cast (§13). Added "relationship deepens, never resets" principle.
- **27 Jun 2026:** Auth foundation LIVE (Better Auth + Drizzle + Neon edge). Real bug = Drizzle adapter needing its schema passed explicitly. Token-cutoff fix + signature ending.
- **26 Jun 2026:** Roadmap reborn as a single living/prioritized document. Demo age + age-scaled stakes + co-star + free-text + length selector + no-markdown. Chose Better Auth over Clerk/Auth.js. Captured input architecture, variable inventory, serialized-cliffhanger direction, character-naming + Leo/Lion collision watch.

---

## 15. Route inventory & cleanup (verified against the repo, 28 Jun)
*Generated by scanning `src/app` directly — this is ground truth, not memory. Re-scan and update whenever routes change.*

**Pages (`page.tsx`):** `/` (home) · `/pricing` · `/signup` · `/login` · `/forgot-password` · `/reset-password` · `/dashboard` · `/dashboard/children/new` · `/dashboard/children/[id]` · `/privacy` · `/terms` · `/safety` · **`/start`** (see cleanup).

**API routes (`route.ts`):** `/api/auth/[...all]` · `/api/generate-story` · `/api/profile` · `/api/profile/[id]` (single-child GET/PATCH/DELETE — backs the `[id]` view) · `/api/checkout` · `/api/subscription` · `/api/billing-portal` · `/api/stripe/webhook` · `/api/admin/metrics` · **`/api/waitlist`** (see cleanup).

**🔧 Cleanup / dead code (confirmed orphaned this session):**
- **`/start/page.tsx` — SHOULD-FIX, not just tidy.** An old pre-Stripe onboarding wizard (name/age/animal → story → "start trial") whose trial button posts to `/api/waitlist` with `source:"first-story"`. It predates the conversion spine, hardcodes `adventure:"The Forest"`/`color:"green"`, defaults age to "5", and **dead-ends a parent into the removed waitlist.** If any old CTA/ad/bookmark points at `/start`, it's a broken funnel. **Decide: delete it, or redirect `/start` → `/` (or `/signup`).**
- **`/api/waitlist/route.ts` + `src/components/Waitlist.tsx` + `src/app/waitlist/page.tsx` — orphaned (the page surfaced 29 Jun).** The waitlist section was removed from the homepage; the API, component, AND a still-deployed `/waitlist` *page* are now dead (only `/start` still calls the API). The `/waitlist/page.tsx` was committed 29 Jun (it had been sitting in the working tree, already live). **Remove all four — `/waitlist`, `/start`, `/api/waitlist`, `Waitlist.tsx` — together, or redirect.**
- **`/api/admin/metrics` exists, but there is NO `/admin/dashboard/page.tsx`.** The founder-metrics API is built; the admin dashboard *page* is not. The Cloudflare Access re-scope pointed the wall at `/admin/dashboard` (a page that doesn't exist yet). **TODO when founder metrics are wanted:** build `/admin/dashboard/page.tsx` (behind Access) that reads `/api/admin/metrics`.
- Previously noted: delete `diag_%` test users from Neon `user` table (still open). ✅ **`.DS_Store` + `tsbuildinfo` — DONE 29 Jun:** added to `.gitignore`, un-tracked from the repo (root + `src/` + `src/app/` `.DS_Store`, plus `tsconfig.tsbuildinfo`), confirmed clean via `git ls-files`.


---

## 16. Reviewer access-code generator (requirements — to build during Stripe review)

**Purpose:** grant invited reviewers full access during the Stripe-review window (and beyond) to gather beta feedback — WITHOUT faking Stripe subscriptions or waiting on the live switch.

**Design principle:** a redeemed code grants the same `getAccess() = true` that a paid subscription grants, via a **separate access path** — never write fake Stripe customers/subscriptions (keeps the live account clean for review). Adds a second path to access; does not touch the Stripe/webhook logic.

**Data model:**
- `access_codes` — code, label/who-it's-for, max redemptions, redemptions-used, expiry, active flag, created-at.
- per-redemption grant keyed to `user.id` — source = `reviewer`, expiry (e.g. 30–60 days), plan = `family` (so reviewers can add multiple kids + exercise co-star mode).

**`getAccess()` change:** add one early check — an active, unexpired reviewer grant → return access (plan = family); Stripe stays the fallback path. **Still fails closed** on any lookup error.

**Redeem flow:** logged-in user enters a code → validate (exists, active, not expired, under max redemptions) → write the grant row → access flips on.

**Generator UI:** lives in the admin section. **Forces finally building `/admin/dashboard/page.tsx`** — today only `/api/admin/metrics` exists, and the Cloudflare Access wall points at a page that isn't built yet.

**Security (NON-NEGOTIABLE):** the *mint-code* API route must be **server-side protected behind Cloudflare Access**, not just the page. An unprotected mint endpoint is a free-subscription faucet. Verify the route is walled, don't assume.

**Scope:** a focused build session, not a quick job. Sequence after Stripe staging (done). Fits inside the 2–3 day review window.

**Open question:** reviewer grants — time-boxed (expire) AND/OR manually revocable? Recommend **both** (expiry as the default safety net, revoke for control).

**Relationship to gifting:** shares spirit with the planned `gift_codes` table (§1 SOMEDAY) but is a separate, simpler reviewer-only mechanism; can converge later.
