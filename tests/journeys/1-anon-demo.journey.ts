// Journey 1 — anonymous demo → streaming story → signup CTA.
import type { Page } from "@playwright/test";
import { BASE_URL, assert, AssertionError } from "./_shared";

export const name = "1 · Anonymous demo (streaming) → signup CTA";

export async function run(page: Page) {
  // 1-3. Open /try, fill the name, start generation.
  await page.goto(`${BASE_URL}/try`, { waitUntil: "domcontentloaded" });
  await page.locator("#lw-name").fill("Ava");
  await page.getByRole("button", { name: /read tonight'?s story/i }).click();

  // 4. Streaming text appears within 5000ms (the StreamingStory caret shows, or
  //    the child's name appears in the story panel).
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector(".night-panel");
      if (!el) return false;
      return !!el.querySelector("span.animate-pulse") || /Ava/.test(el.textContent || "");
    }, { timeout: 5000 });
  } catch {
    throw new AssertionError("step 4: streaming text did not appear in the story panel within 5000ms");
  }

  // 5. Completion: "Write another" appears within 35000ms.
  try {
    await page.getByRole("button", { name: /write another/i }).waitFor({ state: "visible", timeout: 35000 });
  } catch {
    throw new AssertionError("step 5: 'Write another' (story completion) did not appear within 35000ms");
  }

  // 6. A signup link exists (the post-story CTA lives on the final book page —
  //    page to it, then assert an href containing /signup).
  let found = (await page.locator('a[href*="signup"]').count()) > 0;
  if (!found) {
    await page.getByRole("button", { name: /^begin$/i }).first().click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 15 && !found; i++) {
      found = (await page.locator('a[href*="signup"]').count()) > 0;
      if (found) break;
      const next = page.getByRole("button", { name: /next/i }).first();
      if (!(await next.isEnabled().catch(() => false))) break;
      await next.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    found = (await page.locator('a[href*="signup"]').count()) > 0;
  }
  assert(found, "step 6: a link containing '/signup' should exist (post-story conversion CTA)");
}
