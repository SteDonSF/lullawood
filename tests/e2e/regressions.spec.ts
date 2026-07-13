import { test, expect } from "@playwright/test";

// Phase C verification net — guards the routes/redirects/nav that the Phase A
// (shareable routes) and Phase B (honesty + orphan cleanup) work established,
// so a regression trips CI instead of production.

test("/try loads and contains the demo form", async ({ page }) => {
  await page.goto("/try");
  await expect(page.locator("#lw-name")).toBeVisible(); // child name field
  await expect(page.locator("#lw-age")).toBeVisible(); // age field
  await expect(page.getByRole("button", { name: /read tonight'?s story/i })).toBeVisible();
});

test("/how-it-works loads and has a real <h1>", async ({ page }) => {
  await page.goto("/how-it-works");
  const h1 = page.locator("h1").first();
  await expect(h1).toBeVisible();
  expect((await h1.innerText()).trim().length).toBeGreaterThan(0);
});

test("/pricing loads with status 200", async ({ request }) => {
  const res = await request.get("/pricing");
  expect(res.status()).toBe(200);
});

test("/start redirects to /signup (308)", async ({ request }) => {
  const res = await request.get("/start", { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers()["location"]).toBe("/signup");
});

test("/waitlist redirects to / (308)", async ({ request }) => {
  const res = await request.get("/waitlist", { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers()["location"]).toBe("/");
});

test("the mobile nav contains a working login link", async ({ page }) => {
  await page.goto("/");
  // Whichever /login link is visible in this viewport (nav on desktop,
  // dedicated mobile link on phones) must actually navigate to /login.
  const login = page.locator('a[href="/login"]:visible').first();
  await expect(login).toBeVisible();
  await login.click();
  await expect(page).toHaveURL(/\/login$/);
});

test("no internal link on / returns a 404", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.$$eval("a[href]", (els) =>
    els.map((e) => e.getAttribute("href")!)
  );
  const internal = [...new Set(hrefs)]
    .filter((h) => h.startsWith("/") && !h.startsWith("//"))
    .map((h) => h.split("#")[0])
    .filter(Boolean);
  for (const href of internal) {
    const res = await request.get(href, { maxRedirects: 0 });
    expect(res.status(), `internal link ${href} returned ${res.status()}`).not.toBe(404);
  }
});
