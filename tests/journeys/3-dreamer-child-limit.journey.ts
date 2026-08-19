// Journey 3 — Dreamer at their 1-child limit → upgrade path, with nothing typed lost.
// Non-destructive: the API rejects the 2nd child with 403 BEFORE inserting, so no
// child is created and no Stripe checkout is started (we only assert the CTA).
import type { Page } from "@playwright/test";
import { BASE_URL, AssertionError, SkipError, assertVisibleText, login } from "./_shared";

export const name = "3 · Dreamer child-limit → upgrade path keeps the typed child";

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

  // 5. Add-child page warns about the cap up front (before anything is typed) and
  //    still offers the Family upgrade.
  await page.goto(`${BASE_URL}/dashboard/children/new`, { waitUntil: "domcontentloaded" });
  await assertVisibleText(
    page,
    /Dreamer covers 1 child/i,
    "step 5: at-the-cap notice should appear on the add-child form for a Dreamer with 1 child",
  );
  await assertVisibleText(
    page,
    /upgrade to family/i,
    "step 5: 'Upgrade to Family' CTA should appear when a Dreamer is at the 1-child limit",
  );

  // 6-8. Fill name + age and submit (this hits the 1-child cap → 403 pre-insert).
  await page.locator('input[placeholder="e.g. Arno"]').fill("TestChild");
  await page.locator('input[placeholder="e.g. 8"]').fill("6");
  await page.getByRole("button", { name: /save and continue/i }).click();

  // 9. Refused saves send them to /pricing to upgrade.
  try {
    await page.waitForURL(/\/pricing/, { timeout: 15000 });
  } catch {
    throw new AssertionError("step 9: a refused save at the child limit should send the parent to /pricing");
  }

  // 10. The regression this journey guards: coming back, the form still holds
  //     everything they typed (parked in sessionStorage before the redirect).
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
      `step 10: the add-child form should prefill what was typed before the /pricing bounce (name was "${await nameInput.inputValue().catch(() => "")}")`,
    );
  }

  // 11. Leave the browser session clean — the draft is only for a real upgrade.
  await page.evaluate(() => window.sessionStorage.removeItem("lullawood:pendingChild"));
}
