// Journey 2 — reviewer login → dashboard shows comp access, not a broken button.
import type { Page } from "@playwright/test";
import { assert, AssertionError, assertVisibleText, bodyText, login } from "./_shared";

export const name = "2 · Reviewer dashboard (Family / Complimentary access)";

export async function run(page: Page) {
  const email = process.env.UX_AUDIT_TEST_EMAIL;
  const password = process.env.UX_AUDIT_TEST_PASSWORD;
  assert(email && password, "UX_AUDIT_TEST_EMAIL / UX_AUDIT_TEST_PASSWORD must be set in .env.local");

  // 1-3. Log in; assert /dashboard within 15000ms (cold-tolerant).
  await login(page, email!, password!, 15000);

  // The plan card is populated by a client fetch to /api/subscription — wait for it.
  await assertVisibleText(page, "Family plan", "step 4: dashboard should show 'Family plan'", 15000);

  const body = await bodyText(page);
  // 4-6. Case-sensitive so the 'Reviewer' badge isn't confused with 'reviewer code'.
  assert(body.includes("Family plan"), "step 4: page should contain 'Family plan'");
  assert(body.includes("Reviewer"), "step 5: page should contain the 'Reviewer' status badge");
  assert(body.includes("Complimentary access"), "step 6: page should contain 'Complimentary access'");

  // 7. No 'Manage subscription' button for reviewers (it's replaced).
  const manageBtn = await page.getByRole("button", { name: /manage subscription/i }).count();
  assert(manageBtn === 0, "step 7: 'Manage subscription' button should be absent for reviewer accounts");

  // 8. At least one child row with a 'Tonight's story' affordance. The children
  //    list is a separate async fetch from the plan card, so wait for it.
  try {
    await page.getByText(/tonight'?s story/i).first().waitFor({ state: "visible", timeout: 15000 });
  } catch {
    throw new AssertionError("step 8: at least one child row with 'Tonight's story' should exist");
  }
}
