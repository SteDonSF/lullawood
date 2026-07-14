/**
 * run-journeys.ts — the E2E journey suite runner.
 *
 * Auto-discovers every tests/journeys/*.journey.ts, runs each in a fresh browser
 * context against BASE_URL (UX_AUDIT_BASE_URL || https://lullawood.com), and
 * prints PASS / FAIL / SKIP for each — with the exact failing assertion on a FAIL.
 * Credentials come from .env.local (loaded here); journeys never hardcode them.
 *
 * RUN:  npx tsx scripts/run-journeys.ts
 * Exit code: 0 if no failures, 1 if any journey FAILs (skips don't fail the run).
 */
import { chromium } from "@playwright/test";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvLocal, AssertionError, SkipError, BASE_URL } from "../tests/journeys/_shared";

loadEnvLocal();

const DIR = "tests/journeys";

type Result = { name: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string; ms: number };

async function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".journey.ts")).sort();
  console.log(`E2E journeys → ${BASE_URL}  (${files.length} found)\n`);

  const browser = await chromium.launch();
  const results: Result[] = [];

  for (const file of files) {
    const mod = await import(pathToFileURL(resolve(DIR, file)).href);
    const name: string = mod.name || file;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const t0 = Date.now();
    try {
      await mod.run(page);
      const ms = Date.now() - t0;
      results.push({ name, status: "PASS", ms });
      console.log(`✓ PASS  ${name}  (${(ms / 1000).toFixed(1)}s)`);
    } catch (e: any) {
      const ms = Date.now() - t0;
      if (e instanceof SkipError) {
        results.push({ name, status: "SKIP", detail: e.message, ms });
        console.log(`— SKIP  ${name}\n        ${e.message}`);
      } else if (e instanceof AssertionError) {
        results.push({ name, status: "FAIL", detail: e.message, ms });
        console.log(`✗ FAIL  ${name}\n        failed assertion: ${e.message}`);
      } else {
        results.push({ name, status: "FAIL", detail: `unexpected error: ${e?.message ?? e}`, ms });
        console.log(`✗ FAIL  ${name}\n        unexpected error: ${e?.message ?? e}`);
      }
    } finally {
      await ctx.close();
    }
  }
  await browser.close();

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  console.log(`\n=== ${pass} passed · ${fail} failed · ${skip} skipped (of ${results.length}) ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("runner error:", e); process.exit(1); });
