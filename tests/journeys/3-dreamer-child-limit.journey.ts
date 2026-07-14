// Journey 3 — Dreamer at their 1-child limit → "Upgrade to Family" CTA.
// Non-destructive: the API rejects the 2nd child with 403 BEFORE inserting, so no
// child is created and no Stripe checkout is started (we only assert the CTA).
import type { Page } from "@playwright/test";
import { BASE_URL, AssertionError, SkipError, assertVisibleText, login } from "./_shared";

export const name = "3 · Dreamer child-limit → Upgrade to Family CTA";

export async function run(page: Page) {
  const email = process.env.UX_AUDIT_DREAMER_EMAIL;
  const password = process.env.UX_AUDIT_DREAMER_PASSWORD;

  // 1. Skip cleanly if the dreamer account isn't seeded.
  if (!email || !password) {
    throw new SkipError("dreamer account not seeded (UX_AUDIT_DREAMER_EMAIL / UX_AUDIT_DREAMER_PASSWORD empty)");
  }

  // 2-3. Log in; assert /dashboard.
  await login(page, email, password);

  // 4. Dashboard shows the Dreamer plan.
  await assertVisibleText(page, "Dreamer plan", "step 4: dashboard should show 'Dreamer plan'", 10000);

  // 5-8. Go to add-child, fill name + age, submit (this hits the 1-child cap).
  await page.goto(`${BASE_URL}/dashboard/children/new`, { waitUntil: "domcontentloaded" });
  await page.locator('input[placeholder="e.g. Arno"]').fill("TestChild");
  await page.locator('input[placeholder="e.g. 8"]').fill("6");
  await page.getByRole("button", { name: /save and continue/i }).click();

  // 9. The child-limit upgrade CTA appears (no child was created — 403 pre-insert).
  try {
    await page.getByText(/upgrade to family/i).first().waitFor({ state: "visible", timeout: 15000 });
  } catch {
    throw new AssertionError("step 9: 'Upgrade to Family' CTA should appear when a Dreamer hits the 1-child limit");
  }
}
