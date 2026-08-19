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

// A parent used to lose the entire add-child form when a refused save took them
// off the page. What they typed is now parked in localStorage
// ("lullawood:pendingChild") before we leave, and prefilled on the way back.
// The plan/count/POST responses are stubbed so these run without a seeded
// account — the server-side cap itself is covered by journey 3.

const CHILD_FIELDS = {
  name: "e.g. Arno",
  age: "e.g. 8",
  animal: "e.g. fox",
  interests: "e.g. soccer, space, dinosaurs",
  about: /Their personality, favourite colour/i,
  avoid: "e.g. spiders, thunderstorms",
};

async function fillChildForm(page: import("@playwright/test").Page) {
  await page.getByPlaceholder(CHILD_FIELDS.name).fill("Rowan");
  await page.getByPlaceholder(CHILD_FIELDS.age).fill("6");
  await page.getByPlaceholder(CHILD_FIELDS.animal).fill("otter");
  await page.getByPlaceholder(CHILD_FIELDS.interests).fill("boats, rockpools");
  await page.getByRole("button", { name: /more about/i }).click();
  await page.getByPlaceholder(CHILD_FIELDS.about).fill("Sleeps with a knitted otter called Pip.");
  await page.getByPlaceholder(CHILD_FIELDS.avoid).fill("thunderstorms");
}

async function expectChildFormPrefilled(page: import("@playwright/test").Page) {
  await expect(page.getByPlaceholder(CHILD_FIELDS.name)).toHaveValue("Rowan");
  await expect(page.getByPlaceholder(CHILD_FIELDS.age)).toHaveValue("6");
  await expect(page.getByPlaceholder(CHILD_FIELDS.animal)).toHaveValue("otter");
  await expect(page.getByPlaceholder(CHILD_FIELDS.interests)).toHaveValue("boats, rockpools");
  // The "+ More" section auto-opens so restored answers aren't hidden.
  await expect(page.getByPlaceholder(CHILD_FIELDS.about)).toHaveValue(
    "Sleeps with a knitted otter called Pip."
  );
  await expect(page.getByPlaceholder(CHILD_FIELDS.avoid)).toHaveValue("thunderstorms");
}

test("a parent with no plan keeps their typed child across the /pricing bounce", async ({ page }) => {
  await page.route("**/api/subscription", (route) =>
    route.fulfill({ json: { hasAccess: false, plan: null, status: null } })
  );
  await page.route("**/api/profile", (route) => {
    if (route.request().method() === "POST") {
      // Same shape /api/profile returns for a parent with no active plan.
      return route.fulfill({
        status: 402,
        json: { error: "no_subscription", message: "Start a free trial to add a child." },
      });
    }
    return route.fulfill({ json: { children: [] } });
  });

  // The mount fetches only fire after hydration, so waiting on one proves the
  // form is live before we type into it.
  const mounted = page.waitForResponse((r) => r.url().includes("/api/subscription"));
  await page.goto("/dashboard/children/new");
  await mounted;

  await fillChildForm(page);
  await page.getByRole("button", { name: /save and continue/i }).click();
  // Generous timeout: a cold dev server compiles /pricing on this first hit.
  await expect(page).toHaveURL(/\/pricing$/, { timeout: 20_000 });

  // Back on the form: every field is exactly as they left it, optional ones included.
  await page.goto("/dashboard/children/new");
  await expectChildFormPrefilled(page);
});

test("a Dreamer at the child cap gets the upgrade panel in place, draft intact", async ({ page }) => {
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

  // The at-the-cap notice is up before a single field is typed — and its
  // presence means the mount fetches resolved, so the form is hydrated.
  await expect(page.getByText(/Dreamer covers 1 child\. Family covers up to 4/i)).toBeVisible();

  await fillChildForm(page);
  await page.getByRole("button", { name: /save and continue/i }).click();

  // A refused save at the cap stays on the form and shows the upgrade panel.
  await expect(page.getByText("The Dreamer plan includes one child.")).toBeVisible();
  await expect(page.getByRole("button", { name: /upgrade to family/i })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/children\/new$/);

  // The draft is parked all the same — upgrading leaves this page for Stripe,
  // which returns the parent to /dashboard.
  await page.goto("/dashboard/children/new");
  await expectChildFormPrefilled(page);
});

// The money path, client side: "Upgrade to Family" must call the in-place swap
// route and stay on the page — never /api/checkout, which would open a second
// subscription. (Journey 7 asserts the Stripe side against a real account.)
test("Upgrade to Family swaps the plan in place and never opens checkout", async ({ page }) => {
  const called: string[] = [];
  await page.route("**/api/checkout", (route) => {
    called.push("checkout");
    return route.fulfill({ json: { url: "https://checkout.stripe.com/should-never-happen" } });
  });
  await page.route("**/api/subscription", (route) =>
    route.fulfill({ json: { hasAccess: true, plan: "dreamer", status: "active" } })
  );
  await page.route("**/api/subscription/upgrade", (route) => {
    called.push("upgrade");
    return route.fulfill({ json: { ok: true, plan: "family", changed: true, synced: true } });
  });
  await page.route("**/api/profile", (route) => {
    if (route.request().method() === "POST") {
      called.push("save");
      return route.fulfill({ status: 200, json: { child: { id: "kid-2" } } });
    }
    return route.fulfill({ json: { children: [{ id: "kid-1", name: "Arno", age: 8, storyCount: 2 }] } });
  });

  await page.goto("/dashboard/children/new");
  await expect(page.getByText(/Dreamer covers 1 child\. Family covers up to 4/i)).toBeVisible();
  await fillChildForm(page);
  await page.getByRole("button", { name: /upgrade to family/i }).click();

  // The form was filled, so the switch finishes the save the parent started —
  // and the child lands, meaning the route wrote plan=family before responding.
  await expect(page).toHaveURL(/\/dashboard\/children\/kid-2$/, { timeout: 20_000 });
  expect(called).toContain("upgrade");
  expect(called).toContain("save");
  expect(called).not.toContain("checkout");
});

// A parent with nothing to switch (reviewer grant / lapsed plan) is sent to
// /pricing with their draft parked, not shown a raw error.
test("an upgrade with no subscription to change parks the draft and goes to /pricing", async ({ page }) => {
  await page.route("**/api/subscription", (route) =>
    route.fulfill({ json: { hasAccess: true, plan: "dreamer", status: "reviewer" } })
  );
  await page.route("**/api/subscription/upgrade", (route) =>
    route.fulfill({
      status: 409,
      json: { error: "no_stripe_subscription", action: "choose_plan", message: "There's no billing plan on this account to change yet." },
    })
  );
  await page.route("**/api/profile", (route) =>
    route.fulfill({ json: { children: [{ id: "kid-1", name: "Arno", age: 8, storyCount: 0 }] } })
  );

  await page.goto("/dashboard/children/new");
  await expect(page.getByRole("button", { name: /upgrade to family/i })).toBeVisible();
  await fillChildForm(page);
  await page.getByRole("button", { name: /upgrade to family/i }).click();
  await expect(page).toHaveURL(/\/pricing$/, { timeout: 20_000 });

  await page.goto("/dashboard/children/new");
  await expectChildFormPrefilled(page);
});

// A failed cap check must announce itself. Silently behaving like "plenty of
// room" is what hid the missing at-cap notice in the first place.
test("a failed plan check says so instead of looking like room to spare", async ({ page }) => {
  await page.route("**/api/subscription", (route) =>
    route.fulfill({ json: { hasAccess: true, plan: "dreamer", status: "active" } })
  );
  let attempt = 0;
  await page.route("**/api/profile", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    attempt += 1;
    // First load fails the way a DB read hiccup does; the retry succeeds.
    if (attempt === 1) {
      return route.fulfill({ status: 503, json: { error: "children_unavailable" } });
    }
    return route.fulfill({ json: { children: [{ id: "kid-1", name: "Arno", age: 8, storyCount: 0 }] } });
  });

  await page.goto("/dashboard/children/new");
  await expect(page.getByText(/couldn't check your plan just now/i)).toBeVisible();
  // The form is still usable underneath, and the notice offers a way back.
  await expect(page.getByPlaceholder("e.g. Arno")).toBeEditable();
  await page.getByRole("button", { name: /try again/i }).click();
  await expect(page.getByText(/Dreamer covers 1 child\. Family covers up to 4/i)).toBeVisible();
  await expect(page.getByText(/couldn't check your plan just now/i)).toHaveCount(0);
});

// /pricing must turn checkout's 409 into the in-place switch, never a retry.
test("/pricing offers the in-place switch when checkout refuses a second plan", async ({ page }) => {
  await page.route("**/api/checkout", (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: "already_subscribed",
        plan: "dreamer",
        requestedPlan: "family",
        upgradeable: true,
        message: "You're on the Dreamer plan — switch to Family instead of starting a new one.",
      },
    })
  );
  await page.route("**/api/subscription/upgrade", (route) =>
    route.fulfill({ json: { ok: true, plan: "family", changed: true, synced: true } })
  );

  await page.goto("/pricing");
  const familyCard = page.locator("div").filter({ has: page.getByRole("heading", { name: "Family" }) }).last();
  await familyCard.getByRole("button", { name: /start free trial/i }).click();

  await expect(page.getByText(/switch to family instead of starting a new one/i)).toBeVisible();
  await expect(page).toHaveURL(/\/pricing$/);

  await page.getByRole("button", { name: /switch to family/i }).click();
  await expect(page.getByText(/you're on the family plan/i)).toBeVisible();
});
