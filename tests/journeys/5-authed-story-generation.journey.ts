// Journey 5 — authed parent generates a story from a saved child profile.
// NOTE: the authed child page currently does NOT stream (only the anonymous demo
// does), so the "streaming within 5000ms" assertion is expected to reveal that gap
// until the authed path is streamed too.
import type { Page } from "@playwright/test";
import { assert, AssertionError, login } from "./_shared";

export const name = "5 · Authed story generation (child page)";

export async function run(page: Page) {
  const email = process.env.UX_AUDIT_TEST_EMAIL;
  const password = process.env.UX_AUDIT_TEST_PASSWORD;
  assert(email && password, "UX_AUDIT_TEST_EMAIL / UX_AUDIT_TEST_PASSWORD must be set in .env.local");

  // Capture console errors for the whole journey.
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${(e.message || String(e)).slice(0, 200)}`));

  // 1-3. Login → dashboard (within 20000ms, cold-tolerant).
  await login(page, email!, password!, 20000);

  // 4. Open the first child's page via its "Tonight's story" link.
  const childLink = page.getByRole("link").filter({ hasText: /tonight'?s story/i }).first();
  try {
    await childLink.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    throw new AssertionError("no child row with a 'Tonight's story' link found on the dashboard");
  }
  await childLink.click();
  await page.waitForURL(/\/dashboard\/children\/[^/]+$/, { timeout: 8000 }).catch(() => {});

  // 5. Start generation.
  await page.getByRole("button", { name: /write tonight'?s story/i }).click();

  // 6. Streaming text begins within 5000ms. (The authed page renders the story
  //    <article> only once complete, so on the current build this fails — it flags
  //    that the authed path is not streamed.)
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector(".night-panel");
      return !!el && !!el.querySelector("article");
    }, { timeout: 5000 });
  } catch {
    throw new AssertionError("streaming text did not begin within 5000ms (authed generation is not streamed — only the anon demo streams)");
  }

  // 7. Story completes within 45000ms.
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector(".night-panel article");
      return !!el && (el.textContent || "").length > 200;
    }, { timeout: 45000 });
  } catch {
    throw new AssertionError("story did not complete within 45000ms");
  }

  // 8. No console errors.
  assert(
    consoleErrors.length === 0,
    `expected 0 console errors, saw ${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(" | ")}`
  );
}
