// Journey 3 — Dreamer at their 1-child limit → "Upgrade to Family" CTA, and the
// typed child survives the upgrade round trip.
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
  await assertVisibleText(page, "Dreamer plan", "step 4: dashboard should show 'Dreamer plan'", 15000);

  // 5-8. Go to add-child, fill name + age, submit (this hits the 1-child cap).
  await page.goto(`${BASE_URL}/dashboard/children/new`, { waitUntil: "domcontentloaded" });
  await page.locator('input[placeholder="e.g. Arno"]').fill("TestChild");
  await page.locator('input[placeholder="e.g. 8"]').fill("6");
  await page.getByRole("button", { name: /save and continue/i }).click();

  // 9. The child-limit upgrade CTA appears in place (no child was created — 403
  //    pre-insert) and the parent stays on the form.
  try {
    await page.getByText(/upgrade to family/i).first().waitFor({ state: "visible", timeout: 15000 });
  } catch {
    throw new AssertionError("step 9: 'Upgrade to Family' CTA should appear when a Dreamer hits the 1-child limit");
  }
  if (!/\/dashboard\/children\/new/.test(page.url())) {
    throw new AssertionError(`step 9: a refused save at the child limit should stay on the form (now on ${page.url()})`);
  }

  // 10. The data-loss regression: the refused save parks what was typed, so
  //     coming back to the form (as they do after upgrading via Stripe, which
  //     returns them to /dashboard) still holds it.
  await page.goto(`${BASE_URL}/dashboard/children/new`, { waitUntil: "domcontentloaded" });
  const nameInput = page.locator('input[placeholder="e.g. Arno"]');
  try {
    await nameInput.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () => (document.querySelector('input[placeholder="e.g. Arno"]') as HTMLInputElement | null)?.value === "TestChild",
      undefined,
      { timeout: 10000 },
    );
  } catch {
    throw new AssertionError(
      `step 10: the add-child form should prefill the child parked by the refused save (name was "${await nameInput.inputValue().catch(() => "")}")`,
    );
  }

  // 11. Leave the browser profile clean — the draft is only for a real upgrade.
  await page.evaluate(() => window.localStorage.removeItem("lullawood:pendingChild"));
}
