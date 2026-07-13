import { test, expect } from "@playwright/test";

// Phase C verification net — locks the pricing "truth" so a future edit that
// reintroduces a Keepsake tier, wrong price, bad canonical, or a banned
// marketing claim fails CI instead of shipping.

const BANNED = ["read in your voice", "narrated audio", "printed book", "waitlist"];

test("/pricing shows both real tier prices ($8.99, $12.99)", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByText("$8.99").first()).toBeVisible();
  await expect(page.getByText("$12.99").first()).toBeVisible();
});

test('"Keepsake" does not appear as a current tier on /pricing', async ({ page }) => {
  await page.goto("/pricing");
  const body = await page.locator("body").innerText();
  expect(body, "Keepsake tier resurfaced on /pricing").not.toMatch(/keepsake/i);
});

test("/pricing canonical href is exactly the production URL", async ({ page }) => {
  await page.goto("/pricing");
  const href = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(href).toBe("https://lullawood.com/pricing");
});

test("homepage teaser shows the same prices as /pricing", async ({ page }) => {
  await page.goto("/");
  const teaser = page.locator("#pricing");
  const text = await teaser.innerText();
  expect(text, "homepage pricing teaser missing $8.99").toContain("$8.99");
  expect(text, "homepage pricing teaser missing $12.99").toContain("$12.99");
});

for (const path of ["/", "/pricing"]) {
  test(`no banned strings on ${path}`, async ({ page }) => {
    await page.goto(path);
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const s of BANNED) {
      expect(body, `banned string "${s}" present on ${path}`).not.toContain(s);
    }
  });
}
