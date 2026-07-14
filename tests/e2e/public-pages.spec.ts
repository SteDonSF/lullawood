import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/pricing", "/login", "/signup", "/privacy", "/terms", "/safety"];

for (const path of PUBLIC_PAGES) {
  test(`links + anchors resolve on ${path}`, async ({ page, request }) => {
    await page.goto(path);
    const hrefs = await page.$$eval("a[href]", (els) =>
      els.map((e) => e.getAttribute("href")!)
    );
    for (const href of new Set(hrefs)) {
      if (href.startsWith("#")) {
        expect(
          await page.locator(`[id="${href.slice(1)}"]`).count(),
          `dead anchor ${href} on ${path}`
        ).toBeGreaterThan(0);
      } else if (href.startsWith("/")) {
        const res = await request.get(href.split("#")[0]);
        expect(res.status(), `broken link ${href} on ${path}`).toBeLessThan(400);
      }
    }
  });

  test(`banned strings absent on ${path}`, async ({ page }) => {
    await page.goto(path);
    const body = await page.locator("body").innerText();
    expect(body, "waitlist reference survives").not.toMatch(/waitlist/i);
    expect(body, "old $9 price (should be $8.99)").not.toMatch(/\$9(?![.\d])/);
  });
}

test("no CTA points at #waitlist anywhere", async ({ page }) => {
  await page.goto("/");
  expect(await page.locator('a[href*="#waitlist"]').count()).toBe(0);
});
