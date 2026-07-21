# Lullawood UX Audit Rubric

## P0 — blocks launch / advertising / trust

1. Honesty. Does any visible copy claim a feature that isn't shipped (audio narration, read in your voice, printed keepsake, waitlist)?
   - **P2 exception — `public/art/how-pano.webp` "Delivered Every Evening" (on /how-it-works):** Text is atmospheric illustration signage, not a feature claim — low salience at page scale. Replace only if regenerating the asset for other reasons.
2. Dead ends. Does any CTA, nav link, or button lead to a 404, redirect loop, or contradictory page?
3. Pricing drift. Do /, /#pricing, and /pricing show identical numbers and tier names?
4. The 7:58pm test. At 390x844: can a tired parent complete the primary action in a small number of taps, no spinner longer than 2s, no login wall where there shouldn't be one?
5. Broken auth surfaces. Can a returning parent log in from every page they might land on, mobile nav included?

## P1 — hurts conversion, not launch-blocking

6. Trust visibility. Is a safety/privacy/trust signal visible in the hero, demo, or pricing fold?
7. Tap target size. On 390px shots, are primary buttons comfortably tappable one-handed?
8. Contrast. Any low-contrast text against its background?
9. Nav redundancy. Two links doing the same thing with different labels?
10. Form friction. Any form asking for more than the progressive-personalization principle allows at that stage?

## P2 — polish, no urgency

11. Visual consistency. Spacing, font, color drift between pages.
12. Engagement dark patterns. Autoplay-next, streak pressure, urgency/scarcity language.
13. Copy tone. Warm and honest, or generic SaaS filler?

## Output format

For every finding:
- Route + viewport
- Screenshot reference
- Severity (P0/P1/P2)
- What's wrong (one or two sentences, concrete)
- Fix (specific and actionable)

Group by severity, P0 first. End with diff-from-last-audit if a previous run exists.
