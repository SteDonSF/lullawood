// Journey 7 — add-child with ONLY the required fields (name + age).
// Verifies the progressive-personalization form: a parent can save a child by
// filling just the two required fields, leaving every optional field (favourite
// animal, interests, "tell us about them", "never include") empty, and still be
// taken through to the child/dashboard. Guards the P1 form-friction fix.
import type { Page } from "@playwright/test";
import { assert, AssertionError, login, BASE_URL } from "./_shared";

export const name = "6 · Add-child minimal (name + age only)";

export async function run(page: Page) {
  const email = process.env.UX_AUDIT_TEST_EMAIL;
  const password = process.env.UX_AUDIT_TEST_PASSWORD;
  assert(email && password, "UX_AUDIT_TEST_EMAIL / UX_AUDIT_TEST_PASSWORD must be set in .env.local");

  // 8. Capture console errors for the whole journey.
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${(e.message || String(e)).slice(0, 200)}`));

  // 1-2. Log in and reach /dashboard within 5000ms of submit.
  await login(page, email!, password!, 5000);

  // 3. Open the add-child form.
  await page.goto(`${BASE_URL}/dashboard/children/new`, { waitUntil: "domcontentloaded" });
  // Let React hydrate before filling — controlled inputs get reset to "" on
  // hydration, so filling too early submits an empty form (same guard as login()).
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  // 4. Fill ONLY the required fields; leave every optional field untouched.
  const nameInput = page.getByPlaceholder("e.g. Arno");
  const ageInput = page.getByPlaceholder("e.g. 8");
  try {
    await nameInput.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    throw new AssertionError("add-child form did not render its name field within 10000ms");
  }
  await nameInput.fill("TestChild");
  await ageInput.fill("7");
  // Guard against a late hydration wiping the fields.
  if ((await nameInput.inputValue()) !== "TestChild") await nameInput.fill("TestChild");
  if ((await ageInput.inputValue()) !== "7") await ageInput.fill("7");

  // 5. Save.
  await page.getByRole("button", { name: /save and continue/i }).click();

  // 6. Navigate away from the form to /dashboard or /dashboard/children/<id>
  //    (i.e. no longer on /dashboard/children/new) within 5000ms.
  try {
    await page.waitForURL((url) => {
      const p = url.pathname.replace(/\/$/, "");
      if (p.endsWith("/children/new")) return false;
      return p === "/dashboard" || /^\/dashboard\/children\/[^/]+$/.test(p);
    }, { timeout: 5000 });
  } catch {
    // Surface an on-form error message if that's why we didn't move.
    const err = await page.locator("p.text-\\[\\#c2553d\\]").first().innerText().catch(() => "");
    throw new AssertionError(
      `form did not navigate away from /dashboard/children/new within 5000ms` +
      (err ? ` (error shown: "${err.trim()}")` : ` (still on ${new URL(page.url()).pathname})`)
    );
  }

  // 7. No error message visible on the resulting page.
  const errVisible = await page.locator("p.text-\\[\\#c2553d\\]").first().isVisible().catch(() => false);
  assert(!errVisible, "an error message is visible after saving with name + age only");

  // 8. No console errors across the journey.
  assert(
    consoleErrors.length === 0,
    `expected 0 console errors, saw ${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(" | ")}`
  );

  // 9. Self-cleanup (best-effort) — delete the child we just created so TestChild
  //    doesn't accumulate on the shared reviewer account (Family = 4-child cap).
  //    Runs AFTER every assertion above so a cleanup failure can never mask a real
  //    form regression: on non-200 we warn, we never throw.
  const m = new URL(page.url()).pathname.replace(/\/$/, "").match(/^\/dashboard\/children\/([^/]+)$/);
  if (!m) {
    console.warn(`  ⚠ cleanup skipped: no child id in URL (${new URL(page.url()).pathname}) — delete TestChild manually`);
  } else {
    const id = m[1];
    // fetch() runs in the page, so the session cookie is sent automatically.
    const status = await page
      .evaluate(async (cid) => (await fetch(`/api/profile/${cid}`, { method: "DELETE" })).status, id)
      .catch(() => 0);
    if (status === 200) {
      console.log(`  Cleaned up TestChild ${id}`);
    } else {
      console.warn(`  ⚠ cleanup failed: DELETE /api/profile/${id} returned ${status} — TestChild not removed`);
    }
  }
}
