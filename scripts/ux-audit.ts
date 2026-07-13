/**
 * ux-audit.ts — capture harness for the /ux-audit slash command.
 *
 * Produces the exact folder contract the command consumes:
 *   ux-audit/<timestamp>/
 *     <route-slug>/
 *       mobile.png  desktop.png
 *       mobile.a11y.json  desktop.a11y.json
 *       mobile.meta.json  desktop.meta.json
 *     journey_conversion_spine/           (mobile-only step sequence)
 *       01-homepage.png … 06-post-story-cta.png  (+ steps.json)
 *     console-issues.json                 (all console/page/request errors)
 *     manifest.json                       (baseUrl, capturedAt, routes, counts)
 *
 * Viewports: mobile 390x844, desktop 1440x900.
 * Base URL:  UX_AUDIT_BASE_URL env, default https://lullawood.com.
 * Authed routes (/dashboard, /dashboard/children/new) are SKIPPED unless BOTH
 *   UX_AUDIT_TEST_EMAIL and UX_AUDIT_TEST_PASSWORD are set (read from .env.local).
 *
 * Route list is grounded in ROADMAP.md §15, reconciled to current ground truth
 * (§15 mandates re-scanning): Phase A added /how-it-works and /try; /start and
 * /waitlist are now redirects (not pages); /dashboard/children/[id] needs a real
 * child id and /admin/dashboard sits behind the Cloudflare Access wall — both
 * omitted as un-capturable headlessly.
 *
 * RUN:  npx tsx scripts/ux-audit.ts
 */
import { chromium, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

// ---- load .env.local (base URL + optional test creds) ----
(function loadEnvLocal() {
  let raw = "";
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
})();

const BASE_URL = (process.env.UX_AUDIT_BASE_URL ?? "https://lullawood.com").replace(/\/$/, "");
const OUT_ROOT = "ux-audit";

const MOBILE = { width: 390, height: 844 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;

const PUBLIC_ROUTES = [
  "/", "/how-it-works", "/try", "/pricing", "/signup", "/login",
  "/forgot-password", "/reset-password", "/privacy", "/terms", "/safety",
];
// Captured only when test creds are present.
const AUTHED_ROUTES = ["/dashboard", "/dashboard/children/new"];

/** Real selectors, mirrored from src/components/Demo.tsx. */
export const SELECTORS = {
  nameInput: "#lw-name",
  ageInput: "#lw-age",
  generateButton: /read tonight'?s story/i,
  generateAgainButton: /write another/i,
  beginButton: /^begin$/i,
  // The page-turn control's accessible name is "Next page" (aria-label), not "Next".
  nextButton: /next/i,
  postStoryCta: "a.lw-cta-btn",
  storyPanel: ".night-panel",
  tryTeaserLink: '#try a[href="/try"]',
} as const;

type Issue = { route: string; viewport: string; kind: string; type?: string; text: string; url?: string };
const consoleIssues: Issue[] = [];

function slugFor(route: string): string {
  const s = route.replace(/^\//, "").replace(/\/$/, "").replace(/[/[\]]/g, "-");
  return s === "" ? "home" : s;
}

function tsFolder(): string {
  // Regular Node script (not a workflow) — Date is available.
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function attachIssueListeners(page: Page, route: string, viewport: string) {
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") {
      consoleIssues.push({ route, viewport, kind: "console", type: t, text: msg.text().slice(0, 600), url: msg.location()?.url });
    }
  });
  page.on("pageerror", (err) => {
    consoleIssues.push({ route, viewport, kind: "pageerror", text: (err.message || String(err)).slice(0, 600) });
  });
  page.on("requestfailed", (req) => {
    consoleIssues.push({ route, viewport, kind: "requestfailed", text: req.failure()?.errorText ?? "failed", url: req.url() });
  });
}

async function a11yReport(page: Page) {
  return await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
      level: h.tagName.toLowerCase(),
      text: (h.textContent || "").trim().slice(0, 120),
    }));
    const imgs = Array.from(document.querySelectorAll("img"));
    const imagesMissingAlt = imgs.filter((i) => !i.hasAttribute("alt")).map((i) => ({ src: i.getAttribute("src") || "" }));
    const controls = Array.from(document.querySelectorAll("a,button,[role=button]"));
    const controlsMissingAccessibleName = controls
      .filter((c) => {
        const txt = (c.textContent || "").trim();
        const aria = c.getAttribute("aria-label") || c.getAttribute("title") || "";
        const imgAlt = c.querySelector('img[alt]:not([alt=""])');
        return !txt && !aria && !imgAlt;
      })
      .map((c) => ({ tag: c.tagName.toLowerCase(), href: c.getAttribute("href") || undefined, class: (c.getAttribute("class") || "").slice(0, 80) }));
    return {
      title: document.title,
      lang: document.documentElement.getAttribute("lang"),
      headingCount: headings.length,
      h1Count: headings.filter((h) => h.level === "h1").length,
      headings,
      imageCount: imgs.length,
      imagesMissingAlt,
      linkCount: document.querySelectorAll("a[href]").length,
      buttonCount: document.querySelectorAll("button").length,
      controlsMissingAccessibleName,
      landmarks: {
        header: document.querySelectorAll("header").length,
        nav: document.querySelectorAll("nav").length,
        main: document.querySelectorAll("main").length,
        footer: document.querySelectorAll("footer").length,
      },
    };
  });
}

async function captureRoute(ctx: BrowserContext, route: string, viewport: "mobile" | "desktop", dir: string) {
  const slug = slugFor(route);
  const routeDir = `${OUT_ROOT}/${dir}/${slug}`;
  await mkdir(routeDir, { recursive: true });
  const page = await ctx.newPage();
  attachIssueListeners(page, route, viewport);

  const t0 = Date.now();
  let status: number | null = null;
  let finalUrl = "";
  try {
    const resp = await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    status = resp?.status() ?? null;
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(500); // let fonts/hero art settle
    finalUrl = page.url();
    await page.screenshot({ path: `${routeDir}/${viewport}.png`, fullPage: true });
    const a11y = await a11yReport(page);
    await writeFile(`${routeDir}/${viewport}.a11y.json`, JSON.stringify(a11y, null, 2));
    await writeFile(
      `${routeDir}/${viewport}.meta.json`,
      JSON.stringify(
        {
          route,
          slug,
          viewport,
          requestedUrl: `${BASE_URL}${route}`,
          finalUrl,
          redirected: finalUrl.replace(/\/$/, "") !== `${BASE_URL}${route}`.replace(/\/$/, ""),
          httpStatus: status,
          viewportSize: viewport === "mobile" ? MOBILE : DESKTOP,
          title: a11y.title,
          loadMs: Date.now() - t0,
          capturedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    console.log(`  ✓ ${viewport.padEnd(7)} ${route}  (${status}, ${Date.now() - t0}ms)`);
  } catch (e) {
    console.log(`  ✗ ${viewport.padEnd(7)} ${route}  — ${(e as Error).message.slice(0, 80)}`);
    consoleIssues.push({ route, viewport, kind: "capture-error", text: (e as Error).message.slice(0, 300) });
  } finally {
    await page.close();
  }
  return { route, slug, viewport, httpStatus: status, finalUrl };
}

async function login(ctx: BrowserContext, email: string, password: string): Promise<boolean> {
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    return true;
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

async function journeySpine(ctx: BrowserContext, dir: string) {
  const jDir = `${OUT_ROOT}/${dir}/journey_conversion_spine`;
  await mkdir(jDir, { recursive: true });
  const page = await ctx.newPage();
  attachIssueListeners(page, "journey", "mobile");
  const steps: { step: number; name: string; file: string; note: string; ok: boolean }[] = [];
  const shot = async (n: number, name: string, note: string, ok = true) => {
    const file = `${String(n).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path: `${jDir}/${file}`, fullPage: false });
    steps.push({ step: n, name, file, note, ok });
    console.log(`  ${ok ? "✓" : "✗"} journey ${n}: ${name}`);
  };

  try {
    // 1. Homepage
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(1, "homepage", "Landed on homepage (mobile)");

    // 2. Scroll to #try teaser
    await page.locator("#try").scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await shot(2, "try-teaser", "Scrolled to #try teaser section");

    // 3. Click through to /try
    let onTry = false;
    try {
      await page.locator(SELECTORS.tryTeaserLink).first().click({ timeout: 8_000 });
      await page.waitForURL(/\/try$/, { timeout: 15_000 });
      await page.locator(SELECTORS.storyPanel).first().waitFor({ timeout: 10_000 });
      onTry = true;
    } catch {
      // fall back to a direct nav so the rest of the spine still runs
      await page.goto(`${BASE_URL}/try`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      onTry = true;
    }
    await page.waitForTimeout(400);
    await shot(3, "try-page", "Arrived on /try demo", onTry);

    // 4. Fill name field
    await page.locator(SELECTORS.nameInput).fill("Maya");
    await page.waitForTimeout(200);
    await shot(4, "name-filled", 'Filled child name "Maya"');

    // 5. Generate story (real /api/generate-story call — allow generous time).
    //    Completion signal = the form button relabels to "Write another" (unique,
    //    unlike "Begin" which appears twice: cover button + page-turn control).
    let generated = false;
    try {
      await page.getByRole("button", { name: SELECTORS.generateButton }).click({ timeout: 8_000 });
      await page.getByRole("button", { name: SELECTORS.generateAgainButton }).waitFor({ timeout: 120_000 });
      generated = true;
    } catch {
      generated = false;
    }
    await page.waitForTimeout(600);
    await shot(5, "story-generated", generated ? "Story generated (cover shown)" : "Generation did not complete in time", generated);

    // 6. Page through to the post-story CTA (.first() — "Begin"/"Next" each match >1 node)
    let sawCta = false;
    if (generated) {
      try {
        await page.getByRole("button", { name: SELECTORS.beginButton }).first().click({ timeout: 5_000 }).catch(() => {});
        for (let i = 0; i < 14; i++) {
          if (await page.locator(SELECTORS.postStoryCta).isVisible().catch(() => false)) { sawCta = true; break; }
          const next = page.getByRole("button", { name: SELECTORS.nextButton }).first();
          if (!(await next.isEnabled().catch(() => false))) break;
          await next.click().catch(() => {});
          await page.waitForTimeout(250);
        }
        if (sawCta) await page.locator(SELECTORS.postStoryCta).scrollIntoViewIfNeeded().catch(() => {});
      } catch { /* leave sawCta false */ }
    }
    await page.waitForTimeout(300);
    await shot(6, "post-story-cta", sawCta ? "Reached post-story signup CTA" : "Did not reach post-story CTA", sawCta);
  } finally {
    await writeFile(`${jDir}/steps.json`, JSON.stringify(steps, null, 2));
    await page.close();
  }
  return steps;
}

async function main() {
  const dir = tsFolder();
  const capturedAt = new Date().toISOString();
  console.log(`UX audit → ${BASE_URL}\nOutput → ${OUT_ROOT}/${dir}/\n`);
  await mkdir(`${OUT_ROOT}/${dir}`, { recursive: true });

  const browser = await chromium.launch();
  const mobileCtx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const desktopCtx = await browser.newContext({ viewport: DESKTOP });

  const routesCaptured: any[] = [];
  const email = process.env.UX_AUDIT_TEST_EMAIL;
  const password = process.env.UX_AUDIT_TEST_PASSWORD;
  const doAuthed = Boolean(email && password);

  try {
    // ---- public routes (both viewports) ----
    console.log("Public routes:");
    for (const route of PUBLIC_ROUTES) {
      const m = await captureRoute(mobileCtx, route, "mobile", dir);
      const d = await captureRoute(desktopCtx, route, "desktop", dir);
      routesCaptured.push({ route, slug: slugFor(route), authed: false, mobile: { status: m.httpStatus, finalUrl: m.finalUrl }, desktop: { status: d.httpStatus, finalUrl: d.finalUrl } });
    }

    // ---- authed routes (only with creds) ----
    let authedStatus: string;
    if (doAuthed) {
      console.log("\nAuthed routes (logging in)…");
      const okM = await login(mobileCtx, email!, password!);
      const okD = await login(desktopCtx, email!, password!);
      if (okM && okD) {
        for (const route of AUTHED_ROUTES) {
          const m = await captureRoute(mobileCtx, route, "mobile", dir);
          const d = await captureRoute(desktopCtx, route, "desktop", dir);
          routesCaptured.push({ route, slug: slugFor(route), authed: true, mobile: { status: m.httpStatus, finalUrl: m.finalUrl }, desktop: { status: d.httpStatus, finalUrl: d.finalUrl } });
        }
        authedStatus = "captured";
      } else {
        authedStatus = "login-failed";
        console.log("  ✗ login failed — skipping authed routes");
      }
    } else {
      authedStatus = "skipped-no-credentials";
      console.log("\nAuthed routes: skipped (set UX_AUDIT_TEST_EMAIL + UX_AUDIT_TEST_PASSWORD in .env.local to include)");
    }

    // ---- conversion journey (mobile only) ----
    console.log("\nConversion spine (mobile):");
    const journeySteps = await journeySpine(mobileCtx, dir);

    // ---- console issues + manifest ----
    await writeFile(`${OUT_ROOT}/${dir}/console-issues.json`, JSON.stringify(consoleIssues, null, 2));
    const manifest = {
      baseUrl: BASE_URL,
      capturedAt,
      timestamp: dir,
      viewports: { mobile: MOBILE, desktop: DESKTOP },
      routeList: { source: "ROADMAP.md §15 (reconciled to current routes)", public: PUBLIC_ROUTES, authed: AUTHED_ROUTES },
      routesCaptured,
      authedRoutes: authedStatus,
      journey: { name: "journey_conversion_spine", viewport: "mobile", steps: journeySteps.map((s) => ({ step: s.step, name: s.name, file: s.file, ok: s.ok })) },
      consoleIssueCount: consoleIssues.length,
    };
    await writeFile(`${OUT_ROOT}/${dir}/manifest.json`, JSON.stringify(manifest, null, 2));

    console.log(`\n✅ Done. ${routesCaptured.length} routes captured · ${consoleIssues.length} console issues · journey ${journeySteps.filter((s) => s.ok).length}/${journeySteps.length} steps ok`);
    console.log(`   ${OUT_ROOT}/${dir}/manifest.json`);
  } finally {
    await mobileCtx.close();
    await desktopCtx.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ux-audit failed:", e);
  process.exit(1);
});
