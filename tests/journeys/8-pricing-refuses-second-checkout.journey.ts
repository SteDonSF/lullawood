// Journey 8 — /pricing refuses to start a SECOND subscription.
// -----------------------------------------------------------------------------
// The same money-path bug as journey 7, by the other door: a parent already on
// Dreamer clicking "Start free trial" on the Family card used to get a hosted
// checkout — a second subscription, a second trial, the card asked for again.
// /api/checkout now answers 409 already_subscribed and /pricing turns that into
// the in-place "Switch to Family" prompt.
// NON-DESTRUCTIVE: the refusal happens before Stripe is called, and we stop at
// the prompt — clicking "Switch to Family" is journey 7's job, not this one.
import type { Page } from "@playwright/test";
import { BASE_URL, AssertionError, SkipError, assertVisibleText, login } from "./_shared";

export const name = "8 · /pricing refuses a second checkout for a subscribed parent";

export async function run(page: Page) {
  const email = process.env.UX_AUDIT_DREAMER_EMAIL;
  const password = process.env.UX_AUDIT_DREAMER_PASSWORD;

  // 1. Skip cleanly if the dreamer account isn't seeded.
  if (!email || !password) {
    throw new SkipError("dreamer account not seeded (UX_AUDIT_DREAMER_EMAIL / UX_AUDIT_DREAMER_PASSWORD empty)");
  }

  // 2. Log in (asserts /dashboard), then open the plan picker.
  await login(page, email, password);
  await page.goto(`${BASE_URL}/pricing`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  // 3. Press "Start free trial" on the FAMILY card (the second tier card).
  const familyCard = page.locator("div").filter({ has: page.getByRole("heading", { name: "Family" }) }).last();
  const startTrial = familyCard.getByRole("button", { name: /start free trial/i });
  try {
    await startTrial.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    throw new AssertionError("step 3: the Family card's 'Start free trial' button should be on /pricing");
  }
  await startTrial.click();

  // 4. It must NOT open hosted checkout — that would be a 2nd subscription.
  await page.waitForTimeout(3000);
  if (/checkout\.stripe\.com/.test(page.url())) {
    throw new AssertionError(
      "step 4: an already-subscribed parent must not reach hosted checkout — that creates a second subscription",
    );
  }
  if (!/\/pricing/.test(page.url())) {
    throw new AssertionError(`step 4: expected to stay on /pricing, now on ${page.url()}`);
  }

  // 5. Instead they're offered the in-place switch.
  await assertVisibleText(
    page,
    /switch to family/i,
    "step 5: a Dreamer asking for Family should be offered the in-place 'Switch to Family'",
  );
  await assertVisibleText(
    page,
    /no new trial/i,
    "step 5: the prompt should say the switch starts no new trial",
  );
}
