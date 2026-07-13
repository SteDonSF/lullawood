/**
 * memory-loop-test.ts — Phase C, Task 4: prove the episodic-memory loop works
 * end to end for one child: generate 3 stories in sequence and assert that
 *   (a) each generation writes a stories row WITH a non-empty summary, and
 *   (b) by the 3rd story the prompt contains a CONTINUITY block that references
 *       at least one prior night's summary (previousAdventures).
 *
 * It reuses the REAL production functions (buildStoryPrompt / generateStory /
 * summarizeStory) and mirrors the retrieve→generate→summarise→save sequence in
 * src/app/api/generate-story/route.ts (Mode A), so it exercises the actual loop.
 * It skips only the HTTP/auth/reviewer-code wrapper, which is orthogonal to the
 * memory mechanism (the loop depends on the stories table, not on how the caller
 * authenticated).
 *
 * WHY A SCRIPT (not the HTTP route): the route's JSON response does not expose
 * the prompt, and requirement (b) is specifically about the prompt text. Running
 * the loop here lets us capture buildStoryPrompt()'s output directly.
 *
 * CREDENTIALS: reads .env.local automatically (same file Next uses). NEVER pass
 * secrets on the command line or in chat. Requires in .env.local (or the shell):
 *   DATABASE_URL         Neon connection string
 *   ANTHROPIC_API_KEY    for generateStory + summarizeStory
 * Optional:
 *   MEMORY_TEST_CHILD_ID an existing child to test against (else a throwaway
 *                        user+child is created and fully deleted afterwards)
 *   STORY_MODEL, SUMMARY_MODEL (same as the app)
 *
 * RUN (from repo root):  npx tsx scripts/memory-loop-test.ts
 *
 * NON-DESTRUCTIVE: if it creates a throwaway user, it deletes that user at the
 * end (cascade removes the child + its stories). If you pass MEMORY_TEST_CHILD_ID,
 * it deletes only the 3 stories it inserted (by id) and leaves the child intact.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { eq, desc, inArray } from "drizzle-orm";

// ---- load .env.local into process.env BEFORE importing modules that read it ----
(function loadEnvLocal() {
  let raw = "";
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return; // fall back to shell env
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue; // don't override an explicit shell value
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
})();

function need(k: string): string {
  const v = process.env[k];
  if (!v) {
    console.error(`✗ Missing required env var ${k}.`);
    console.error(`  Add it to .env.local (gitignored) — never paste it in chat — then re-run.`);
    process.exit(2);
  }
  return v;
}

const MEMORY_NIGHTS = 6; // must match the route

async function main() {
  need("DATABASE_URL");
  need("ANTHROPIC_API_KEY");

  // Import AFTER env is loaded (these read process.env at module/call time).
  const { getDb, schema } = await import("@/lib/db");
  const { generateStory, summarizeStory } = await import("@/lib/anthropic");
  const { buildStoryPrompt } = await import("@/lib/story/prompt");
  const db = getDb();

  // ----- resolve the child under test (existing, or a throwaway) -----
  let childId = process.env.MEMORY_TEST_CHILD_ID ?? "";
  let throwawayUserId = "";
  if (!childId) {
    throwawayUserId = `memtest-${randomUUID()}`;
    await db.insert(schema.user).values({
      id: throwawayUserId,
      name: "Memory Loop Test",
      email: `memtest-${randomUUID()}@lullawood.test`,
      emailVerified: false,
    });
    const [c] = await db
      .insert(schema.children)
      .values({ parentId: throwawayUserId, name: "Maya", age: 6, animals: ["Fox"] })
      .returning({ id: schema.children.id });
    childId = c.id;
    console.log(`▶ Created throwaway user ${throwawayUserId} + child ${childId}`);
  }

  const [child] = await db.select().from(schema.children).where(eq(schema.children.id, childId)).limit(1);
  if (!child) {
    console.error(`✗ No child with id ${childId}.`);
    process.exit(2);
  }
  console.log(`▶ Memory-loop test for child "${child.name}" (${childId})\n`);

  const insertedIds: string[] = [];
  const evidence: { n: number; summary: string; promptHasContinuity: boolean; referenced: string[] }[] = [];

  try {
    for (let n = 1; n <= 3; n++) {
      // ----- RETRIEVE (mirror route.ts:106-118) -----
      const recent = await db
        .select({ summary: schema.stories.summary })
        .from(schema.stories)
        .where(eq(schema.stories.childId, childId))
        .orderBy(desc(schema.stories.createdAt))
        .limit(MEMORY_NIGHTS);
      const previousAdventures = recent.map((r) => (r.summary ?? "").trim()).filter(Boolean);

      const ctx = {
        profile: {
          name: child.name,
          age: child.age ?? undefined,
          interests: child.interests ?? [],
          colors: child.colors ?? [],
        },
        animal: (child.animals && child.animals[0]) || undefined,
        customRequest: undefined,
        targetMinutes: 3,
        previousAdventures,
        recurringCharacters: child.recurringCharacters ?? [],
      };

      // ----- BUILD PROMPT + capture it -----
      const prompt = buildStoryPrompt(ctx as any);
      const hasContinuity = /CONTINUITY/.test(prompt);
      const referenced = previousAdventures.filter((s) => prompt.includes(s));

      // ----- GENERATE + SUMMARISE + SAVE (mirror route.ts:148-164) -----
      const rawStory = await generateStory(prompt);
      const trimmed = rawStory.trimStart();
      const nl = trimmed.indexOf("\n");
      const title = nl === -1 ? "A Lullawood story" : trimmed.slice(0, nl).trim();
      const storyBody = nl === -1 ? trimmed : trimmed.slice(nl).trim();
      const summary = await summarizeStory(storyBody, child.name);

      const [row] = await db
        .insert(schema.stories)
        .values({ childId, title: title || "A Lullawood story", body: storyBody, summary: summary || null })
        .returning({ id: schema.stories.id, summary: schema.stories.summary });
      insertedIds.push(row.id);

      const ok = Boolean(row.summary && row.summary.trim());
      console.log(`  Story ${n}: saved row ${row.id}`);
      console.log(`    summary: ${ok ? "✓ present" : "✗ EMPTY"} — "${(row.summary ?? "").slice(0, 90)}…"`);
      if (n >= 2) {
        console.log(
          `    prompt CONTINUITY block: ${hasContinuity ? "✓" : "✗"} · prior summaries referenced: ${referenced.length}`
        );
      }
      evidence.push({ n, summary: row.summary ?? "", promptHasContinuity: hasContinuity, referenced });
    }

    // ----- RESULT -----
    const third = evidence[2];
    const summariesOk = evidence.every((e) => e.summary.trim().length > 0);
    const memoryOk = third.promptHasContinuity && third.referenced.length >= 1;

    console.log(`\n=== RESULT ===`);
    console.log(`(a) all 3 generations wrote a non-empty summary: ${summariesOk ? "PASS" : "FAIL"}`);
    console.log(`(b) 3rd prompt CONTINUITY references >=1 prior summary: ${memoryOk ? "PASS" : "FAIL"}`);
    if (memoryOk) console.log(`    referenced: ${third.referenced.map((s) => `"${s.slice(0, 60)}…"`).join(" | ")}`);

    process.exitCode = summariesOk && memoryOk ? 0 : 1;
  } finally {
    // ----- CLEANUP -----
    if (throwawayUserId) {
      await db.delete(schema.user).where(eq(schema.user.id, throwawayUserId)); // cascades child + stories
      console.log(`\n🧹 deleted throwaway user ${throwawayUserId} (cascaded child + stories)`);
    } else if (insertedIds.length) {
      await db.delete(schema.stories).where(inArray(schema.stories.id, insertedIds));
      console.log(`\n🧹 cleaned up ${insertedIds.length} test stories`);
    }
  }
}

main().catch((e) => {
  console.error("memory-loop-test failed:", e);
  process.exit(1);
});
