// Shared helpers for the E2E journey suite (run via scripts/run-journeys.ts).
// Each journey exports `name` + `run(page)`. `run` throws AssertionError on a
// failed assertion (the runner reports its message), or SkipError to skip.
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

export const BASE_URL = (process.env.UX_AUDIT_BASE_URL || "https://lullawood.com").replace(/\/$/, "");

export class AssertionError extends Error {}
export class SkipError extends Error {}

export function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new AssertionError(message);
}

/** Wait for text to become visible; throw AssertionError(message) on timeout. */
export async function assertVisibleText(page: Page, text: string | RegExp, message: string, timeout = 15000) {
  try {
    await page.getByText(text).first().waitFor({ state: "visible", timeout });
  } catch {
    throw new AssertionError(message);
  }
}

/** Read the fully-rendered page text (case-sensitive assertions run against this). */
export async function bodyText(page: Page): Promise<string> {
  return (await page.locator("body").innerText()) || "";
}

/**
 * Fill /login and submit; assert we reach /dashboard within `timeout` ms.
 * ONE-SHOT RETRY: cold-start flakes (a cold Cloudflare isolate / Neon HTTP
 * connection warming up) usually clear on a second try. If the first full
 * attempt doesn't reach /dashboard, wait 2000ms and re-run the entire flow
 * (fresh navigation + refill + resubmit) once more before failing the journey.
 */
export async function login(page: Page, email: string, password: string, timeout = 15000) {
  const attempt = async () => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    // Wait for React to hydrate before filling — otherwise the controlled inputs get
    // reset to "" on hydration and an empty form is submitted. (networkidle is a good
    // hydration proxy for this simple page.)
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const emailInput = page.locator('input[type="email"]');
    const pwInput = page.locator('input[type="password"]');
    await emailInput.fill(email);
    await pwInput.fill(password);
    // Guard against a late hydration wiping the fields.
    if ((await emailInput.inputValue()) !== email) await emailInput.fill(email);
    if ((await pwInput.inputValue()) !== password) await pwInput.fill(password);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout }); // throws on timeout
  };

  try {
    await attempt();
  } catch {
    await page.waitForTimeout(2000);
    try {
      await attempt();
    } catch {
      throw new AssertionError(
        `login did not reach /dashboard within ${timeout}ms after one retry (check credentials in .env.local)`,
      );
    }
  }
}

/** Load .env.local into process.env (shell values win). Called once by the runner. */
export function loadEnvLocal() {
  let raw = "";
  try { raw = readFileSync(".env.local", "utf8"); } catch { return; }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
