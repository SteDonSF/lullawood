// Journey 4 — fresh signup → redeem a reviewer code → Family comp access.
// Creates a throwaway account (logged to ux-audit/journeys-cleanup.log for later
// cleanup) and consumes one of the code's redemptions.
import type { Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { BASE_URL, AssertionError, SkipError, assertVisibleText } from "./_shared";

export const name = "4 · Reviewer-code redemption (fresh signup → Family)";

export async function run(page: Page) {
  const code = process.env.UX_AUDIT_REVIEWER_CODE;
  if (!code) throw new SkipError("no reviewer code (UX_AUDIT_REVIEWER_CODE not set)");

  const email = `audit+${Date.now()}@gmail.com`;
  const password = "AuditPass123!";

  // 1. Sign up a fresh (no-access) account. Wait for hydration so the controlled
  //    inputs keep their values (same race as /login).
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const nameInput = page.locator("input").first(); // "Your name" is the first field
  const emailInput = page.locator('input[type="email"]');
  const pwInput = page.locator('input[type="password"]');
  await nameInput.fill("Audit Tester");
  await emailInput.fill(email);
  await pwInput.fill(password);
  if ((await emailInput.inputValue()) !== email) await emailInput.fill(email);
  await page.getByRole("button", { name: /create account/i }).click();
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  } catch {
    throw new AssertionError("signup did not reach /dashboard within 15000ms");
  }

  // 2. Fresh account shows no plan.
  await assertVisibleText(page, "No active plan", "expected 'No active plan' for a fresh account", 15000);

  // 3. Redeem the reviewer code.
  await page.locator('input[placeholder*="LULLA"]').fill(code);
  await page.getByRole("button", { name: /redeem/i }).click();

  // 4. Redemption grants Family comp access (dashboard re-fetches ~1.4s after success).
  await assertVisibleText(page, "Family plan", "expected 'Family plan' within 15000ms after redeeming", 15000);
  await assertVisibleText(page, "Complimentary access", "expected 'Complimentary access' after redeeming", 15000);

  // 5. Record the throwaway account for later cleanup (ux-audit/ is gitignored).
  try {
    mkdirSync("ux-audit", { recursive: true });
    appendFileSync("ux-audit/journeys-cleanup.log", `${email}\n`);
  } catch { /* best-effort */ }
}
