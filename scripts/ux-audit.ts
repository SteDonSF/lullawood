/**
 * ux-audit.ts — drive the real Lullawood demo end to end and capture each
 * stage (empty form → filled → generating → story cover → story pages →
 * post-story CTA) as screenshots + timings, so we can eyeball the actual
 * bedtime-flow UX rather than guess at it.
 *
 * Run against a running server (dev, preview, or prod):
 *   TEST_URL=http://localhost:3000 npx tsx scripts/ux-audit.ts
 *   TEST_URL=https://lullawood.com npx tsx scripts/ux-audit.ts
 * Output: ./ux-audit-output/*.png  (+ a console timing summary)
 *
 * NOTE: this triggers a real /api/generate-story call (Anthropic + rate limit).
 * Point it at an environment where that's acceptable.
 *
 * SELECTORS below are taken verbatim from the live component
 * src/components/Demo.tsx — keep them in sync if that form changes:
 *   - name input     #lw-name                         (Demo.tsx:315)
 *   - age input      #lw-age                          (Demo.tsx:321)
 *   - companion      <button> chip w/ animal label    (Demo.tsx:329, ANIMALS)
 *   - generate btn   text "Read tonight's story"      (Demo.tsx:393)
 *   - story cover    button "Begin"                   (Demo.tsx:173)
 *   - page turn      button "Next"                     (Demo.tsx:237)
 *   - post-story CTA a.lw-cta-btn "Start … free trial" (Demo.tsx:211-214)
 *   - story panel    .night-panel                     (Demo.tsx:402)
 */
import { chromium, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE_URL = process.env.TEST_URL ?? "http://localhost:3000";
const OUT_DIR = "./ux-audit-output";

/** Real selectors, mirrored from src/components/Demo.tsx. */
export const SELECTORS = {
  nameInput: "#lw-name",
  ageInput: "#lw-age",
  /** Companion chips are <button> elements whose text is the animal name. */
  companion: (animal: string) => ({ role: "button" as const, name: animal, exact: true }),
  /** Primary generate button — label before a story exists. */
  generateButton: /read tonight'?s story/i,
  /** Same button once a story has been generated. */
  generateAgainButton: /write another/i,
  /** Cover slide's advance button. */
  beginButton: /^begin$/i,
  /** Page-turn advance button. */
  nextButton: /^next$/i,
  /** Final-slide signup CTA (personalised → "Start <name>'s free trial"). */
  postStoryCta: "a.lw-cta-btn",
  /** The dark story panel (present whether idle, generating, or showing a story). */
  storyPanel: ".night-panel",
} as const;

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const t: Record<string, number> = {};
  const mark = (k: string, from = 0) => (t[k] = Date.now() - from);

  try {
    console.log(`UX audit → ${BASE_URL}/try`);
    const start = Date.now();
    await page.goto(`${BASE_URL}/try`, { waitUntil: "load" });
    mark("load", start);
    await page.locator(SELECTORS.storyPanel).waitFor();
    await shot(page, "1-empty");

    // Fill the form with the real fields.
    await page.locator(SELECTORS.nameInput).fill("Maya");
    await page.locator(SELECTORS.ageInput).fill("6");
    const fox = SELECTORS.companion("Fox");
    await page.getByRole(fox.role, { name: fox.name, exact: fox.exact }).click();
    await shot(page, "2-filled");

    // Generate.
    const genClick = Date.now();
    await page.getByRole("button", { name: SELECTORS.generateButton }).click();
    await shot(page, "3-generating");

    // Wait for the story cover (the "Begin" button) to appear.
    await page.getByRole("button", { name: SELECTORS.beginButton }).waitFor({ timeout: 60_000 });
    mark("generate", genClick);
    await shot(page, "4-story-cover");

    // Page through to the post-story CTA.
    await page.getByRole("button", { name: SELECTORS.beginButton }).click();
    for (let i = 0; i < 12; i++) {
      const cta = page.locator(SELECTORS.postStoryCta);
      if (await cta.isVisible().catch(() => false)) break;
      const next = page.getByRole("button", { name: SELECTORS.nextButton });
      if (!(await next.isEnabled().catch(() => false))) break;
      await next.click();
    }
    await page.locator(SELECTORS.postStoryCta).waitFor();
    await shot(page, "5-post-story-cta");

    console.log(
      `\n⏱  page load ${t.load}ms · story generated ${t.generate}ms · CTA text: ` +
        `"${(await page.locator(SELECTORS.postStoryCta).innerText()).trim()}"`
    );
    console.log("✅ UX audit complete →", OUT_DIR);
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error("UX audit failed:", e);
  process.exit(1);
});
