/**
 * mint-reviewer-codes.ts — one-off: mint the Phase D reviewer-beta access codes.
 *
 * The admin mint route (/api/admin/access-codes) is walled behind Cloudflare
 * Access and can't be called headlessly, so this inserts directly into the
 * access_codes table using the SAME code format the route uses
 * (LULLA-XXXXXX, alphabet excludes 0/O/1/I). Every code, when redeemed, grants
 * plan=family for 60 days (that plan is hardcoded in /api/redeem-code) — so no
 * plan column is needed on the code itself.
 *
 * Params (Phase D): 5 codes · maxRedemptions 1 · expires 2026-09-13 ·
 * labels Reviewer-01..Reviewer-05.
 *
 * Reads DATABASE_URL from .env.local. RUN:  npx tsx scripts/mint-reviewer-codes.ts
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

(function loadEnvLocal() {
  let raw = "";
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
})();

// LULLA-XXXXXX with the same unambiguous alphabet as the mint route.
function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += alphabet[bytes[i] % alphabet.length];
  return `LULLA-${suffix}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ Missing DATABASE_URL (add it to .env.local, never in chat).");
    process.exit(2);
  }
  const { getDb, schema } = await import("@/lib/db");
  const db = getDb();

  const EXPIRES_AT = new Date("2026-09-13T23:59:59Z"); // 60 days out, per Phase D
  const labels = ["Reviewer-01", "Reviewer-02", "Reviewer-03", "Reviewer-04", "Reviewer-05"];

  const minted: { label: string; code: string; expiresAt: string }[] = [];
  for (const label of labels) {
    const [row] = await db
      .insert(schema.accessCodes)
      .values({ code: makeCode(), label, maxRedemptions: 1, expiresAt: EXPIRES_AT })
      .returning({ code: schema.accessCodes.code, label: schema.accessCodes.label, expiresAt: schema.accessCodes.expiresAt });
    minted.push({ label: row.label ?? label, code: row.code, expiresAt: (row.expiresAt as Date).toISOString() });
    console.log(`  ✓ ${row.label}: ${row.code}  (family · 1 redemption · expires ${(row.expiresAt as Date).toISOString().slice(0, 10)})`);
  }

  console.log(`\nMinted ${minted.length} reviewer codes.`);
}

main().catch((e) => {
  console.error("mint failed:", e);
  process.exit(1);
});
