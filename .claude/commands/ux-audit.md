Run a full UX/UI audit of Lullawood and write the report to UX-AUDIT.md.

Steps:

1. Run the capture script: npx tsx scripts/ux-audit.ts
   Confirm it completed by checking the manifest.json in the newest ux-audit/<timestamp>/ folder.

1b. Run the interactive E2E journey suite: npx tsx scripts/run-journeys.ts
   It drives real user journeys (anon demo streaming, reviewer dashboard, Dreamer child-limit upgrade, …) against the live site using the seeded test accounts in .env.local. Record each journey's PASS / FAIL / SKIP — and on any FAIL, the exact failing assertion — and fold the results into the report as a "User journeys" section. A journey FAIL is at least a P1 (a broken real-user flow); judge severity by which flow broke.

2. Find the previous audit folder (second-most-recent under ux-audit/) if one exists, for diffing later.

3. Read UX-RUBRIC.md in full before evaluating anything.

4. For every route folder in the new capture: view both mobile.png and desktop.png, check console-issues.json, and evaluate against every numbered item in the rubric. Review journey_conversion_spine/ as a sequence.

5. Write UX-AUDIT.md at the repo root with:
   - One-paragraph summary (P0 count, P1 count, P2 count, single most urgent fix)
   - Findings grouped by severity P0 first, each with: route + viewport, screenshot reference, severity, what's wrong, concrete fix
   - Diff from last audit section if a previous run exists
   - Do not soften severity. A P0 is a P0.

6. State in chat: the P0 count, and whether it is currently safe to send paid ad traffic to the site.
