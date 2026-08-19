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

// A Dreamer at their 1-child cap used to lose the entire add-child form when the
// refused save bounced them to /pricing. The typed child is parked in
// sessionStorage ("lullawood:pendingChild") before the redirect and prefilled on
// the way back. The plan/count/POST responses are stubbed so this runs without a
// seeded Dreamer account — the server-side cap itself is covered by journey 3.
test("a Dreamer at the child cap keeps their typed child across the /pricing bounce", async ({ page }) => {
  await page.route("**/api/subscription", (route) =>
    route.fulfill({ json: { hasAccess: true, plan: "dreamer", status: "active" } })
  );
  await page.route("**/api/profile", (route) => {
    if (route.request().method() === "POST") {
      // Same shape /api/profile returns for a Dreamer already at the cap.
      return route.fulfill({
        status: 403,
        json: { error: "child_limit", plan: "dreamer", message: "The Dreamer plan includes one child." },
      });
    }
    return route.fulfill({ json: { children: [{ id: "kid-1", name: "Arno", age: 8, storyCount: 2 }] } });
  });

  await page.goto("/dashboard/children/new");

  // The at-the-cap notice appears before a single field is typed — and its
  // presence means the mount fetches resolved, so the form is hydrated.
  await expect(page.getByText(/Dreamer covers 1 child\. Family covers up to 4/i)).toBeVisible();

  const nameInput = page.getByPlaceholder("e.g. Arno");
  const ageInput = page.getByPlaceholder("e.g. 8");
  const animalInput = page.getByPlaceholder("e.g. fox");
  const interestsInput = page.getByPlaceholder("e.g. soccer, space, dinosaurs");
  const aboutInput = page.getByPlaceholder(/Their personality, favourite colour/i);
  const avoidInput = page.getByPlaceholder("e.g. spiders, thunderstorms");

  await nameInput.fill("Rowan");
  await ageInput.fill("6");
  await animalInput.fill("otter");
  await interestsInput.fill("boats, rockpools");
  await page.getByRole("button", { name: /more about/i }).click();
  await aboutInput.fill("Sleeps with a knitted otter called Pip.");
  await avoidInput.fill("thunderstorms");

  // Refused (403 at the cap) -> bounced to /pricing.
  await page.getByRole("button", { name: /save and continue/i }).click();
  // Generous timeout: a cold dev server compiles /pricing on this first hit.
  await expect(page).toHaveURL(/\/pricing$/, { timeout: 20_000 });

  // Back to the form: every field is exactly as they left it, optional ones included.
  await page.goto("/dashboard/children/new");
  await expect(page.getByPlaceholder("e.g. Arno")).toHaveValue("Rowan");
  await expect(page.getByPlaceholder("e.g. 8")).toHaveValue("6");
  await expect(page.getByPlaceholder("e.g. fox")).toHaveValue("otter");
  await expect(page.getByPlaceholder("e.g. soccer, space, dinosaurs")).toHaveValue("boats, rockpools");
  // The "+ More" section auto-opens so restored answers aren't hidden.
  await expect(page.getByPlaceholder(/Their personality, favourite colour/i)).toHaveValue(
    "Sleeps with a knitted otter called Pip."
  );
  await expect(page.getByPlaceholder("e.g. spiders, thunderstorms")).toHaveValue("thunderstorms");
});
