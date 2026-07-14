/**
 * cleanup-journey-accounts.ts — remove the throwaway accounts created by the E2E
 * journey suite (journey 4 signs up a fresh account per run) and reset the
 * reviewer code it redeems.
 *
 * Reads ux-audit/journeys-cleanup.log (one email per line, written by journey 4).
 * For each email: deletes the user row from Neon — children + stories +
 * access_grants cascade via FK; session + account rows are deleted explicitly
 * (they carry no FK cascade). Then resets redemptions_used on LULLA-5PNM89 to 0
 * and clears the log (only if everything succeeded).
 *
 * Reads DATABASE_URL from .env.local. Never prints credentials.
 * RUN:  npx tsx scripts/cleanup-journey-accounts.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

(function loadEnvLocal() {
  let raw = "";
  try { raw = readFileSync(".env.local", "utf8"); } catch { return; }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
})();

const LOG = "ux-audit/journeys-cleanup.log";
const CODE = "LULLA-5PNM89";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ Missing DATABASE_URL in .env.local");
    process.exit(2);
  }
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);

  // ----- collect throwaway emails from the log -----
  let emails: string[] = [];
  if (existsSync(LOG)) {
    emails = [...new Set(
      readFileSync(LOG, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean)
    )];
  }
  console.log(`Cleanup: ${emails.length} throwaway account(s) listed in ${LOG}`);

  let hadError = false;
  let deleted = 0;

  for (const email of emails) {
    try {
      const rows = await sql`SELECT id FROM "user" WHERE lower(email) = ${email} LIMIT 1`;
      if (!rows.length) {
        console.log(`  · ${email}: no user row (already gone)`);
        continue;
      }
      const uid = rows[0].id as string;
      // session + account carry no FK cascade — delete them first.
      await sql`DELETE FROM session WHERE "userId" = ${uid}`;
      await sql`DELETE FROM account WHERE "userId" = ${uid}`;
      // user delete cascades: children -> stories, and access_grants.
      await sql`DELETE FROM "user" WHERE id = ${uid}`;
      deleted++;
      console.log(`  ✓ ${email}: deleted (children/stories/grants cascaded)`);
    } catch (e: any) {
      hadError = true;
      console.error(`  ✗ ${email}: ${String(e?.message ?? e).replace(/postgres(ql)?:\/\/[^\s]+/gi, "postgresql://***")}`);
    }
  }

  // ----- reset the reviewer code counter -----
  try {
    const before = await sql`SELECT redemptions_used FROM access_codes WHERE code = ${CODE} LIMIT 1`;
    if (before.length) {
      await sql`UPDATE access_codes SET redemptions_used = 0 WHERE code = ${CODE}`;
      console.log(`  ✓ reset ${CODE}: redemptions_used ${before[0].redemptions_used} -> 0`);
    } else {
      console.log(`  · ${CODE}: not found (nothing to reset)`);
    }
  } catch (e: any) {
    hadError = true;
    console.error(`  ✗ reset ${CODE}: ${String(e?.message ?? e).replace(/postgres(ql)?:\/\/[^\s]+/gi, "postgresql://***")}`);
  }

  // ----- clear the log only on full success -----
  if (!hadError) {
    if (existsSync(LOG)) writeFileSync(LOG, "");
    console.log(`\n✅ Cleanup complete — ${deleted} user(s) deleted, ${CODE} reset, log cleared.`);
    process.exit(0);
  } else {
    console.error(`\n⚠️  Cleanup finished with errors — log left intact for a retry.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("cleanup failed:", String(e?.message ?? e).replace(/postgres(ql)?:\/\/[^\s]+/gi, "postgresql://***"));
  process.exit(1);
});
