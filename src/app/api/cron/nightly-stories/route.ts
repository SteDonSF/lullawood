// =============================================================================
// /api/cron/nightly-stories  —  the nightly delivery engine
// -----------------------------------------------------------------------------
// WHAT: Once a day (fired by the lullawood-nightly Cloudflare Cron Worker),
//   generate a fresh bedtime story for every child of every ACTIVE / TRIALING
//   subscriber, save each (is_nightly = true), and email it. When the parent
//   opens the dashboard the story is already waiting — and it's in their inbox.
// TRIGGER: like /api/cron/trial-reminder, a tiny scheduled Worker fetch()es this
//   URL (Pages Functions can't own a Cron Trigger).
// SECURITY: not public. Caller must send  Authorization: Bearer <CRON_SECRET>
//   (same shared secret as the trial-reminder cron). Any mismatch -> 401.
// ENGINE: reuses the on-demand path's generation + episodic-memory pattern —
//   retrieve the last N summaries (continuity + anti-repetition), feed the full
//   child profile + recurring characters, generate, split the title, summarise
//   for tomorrow, and save. Idempotent: one nightly story per child per day.
// SCALING NOTE: children are processed sequentially. For a large base, shard by
//   time or fan out — fine for the soft-launch scale.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { generateStory, summarizeStory } from "@/lib/anthropic";
import { buildStoryPrompt } from "@/lib/story/prompt";
import { getDb, schema } from "@/lib/db";
import { user } from "@/lib/auth-schema";
import { sendNightlyStoryEmail } from "@/lib/resend";

export const runtime = "edge";

const MEMORY_NIGHTS = 6; // recent summaries fed into tonight's story
const APP_URL = process.env.BETTER_AUTH_URL || "https://lullawood.com";

function splitTitle(raw: string): { title: string; story: string } {
  const trimmed = raw.trimStart();
  const nl = trimmed.indexOf("\n");
  if (nl === -1) return { title: "", story: trimmed };
  return { title: trimmed.slice(0, nl).trim(), story: trimmed.slice(nl).trim() };
}

function startOfTodayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });

  const provided = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Test hooks (still secret-gated): ?force=1 bypasses the once-per-day
  // idempotency so a story is regenerated + re-emailed; ?childId=<id> limits the
  // run to a single child (so a test send doesn't email every subscriber).
  const url = new URL(req.url);
  const force = ["1", "true"].includes((url.searchParams.get("force") || "").toLowerCase());
  const onlyChildId = url.searchParams.get("childId");

  const db = getDb();
  const dashboardUrl = `${APP_URL.replace(/\/+$/, "")}/dashboard`;
  const todayStart = startOfTodayUTC();

  type LogEntry = { userId: string; childId: string; success: boolean; error?: string; emailError?: string; skipped?: boolean };
  const results: LogEntry[] = [];
  let total = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  // Every child of every active/trialing subscriber (joined to the auth user for
  // their email + name).
  let subscribers: { userId: string; email: string; name: string }[];
  try {
    subscribers = await db
      .select({ userId: schema.subscriptions.userId, email: user.email, name: user.name })
      .from(schema.subscriptions)
      .innerJoin(user, eq(schema.subscriptions.userId, user.id))
      .where(inArray(schema.subscriptions.status, ["trialing", "active"]));
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "subscriber_query_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  for (const sub of subscribers) {
    // Active children only — don't spend tokens/emails on archived profiles.
    let kids: (typeof schema.children.$inferSelect)[];
    try {
      kids = await db
        .select()
        .from(schema.children)
        .where(and(eq(schema.children.parentId, sub.userId), eq(schema.children.active, true)));
    } catch (err) {
      failed += 1;
      results.push({ userId: sub.userId, childId: "*", success: false, error: `children_query_failed: ${err instanceof Error ? err.message : String(err)}` });
      continue;
    }

    for (const child of kids) {
      // ?childId= limits a test run to a single child (no collateral emails).
      if (onlyChildId && child.id !== onlyChildId) continue;
      total += 1;
      try {
        // Idempotency: skip if a nightly story already exists for today —
        // unless ?force=1, which regenerates + re-emails (for testing).
        const [existing] = await db
          .select({ id: schema.stories.id })
          .from(schema.stories)
          .where(and(eq(schema.stories.childId, child.id), eq(schema.stories.isNightly, true), gte(schema.stories.createdAt, todayStart)))
          .limit(1);
        if (existing && !force) {
          skipped += 1;
          results.push({ userId: sub.userId, childId: child.id, success: true, skipped: true });
          continue;
        }

        // Retrieve recent summaries for continuity + anti-repetition.
        let previousAdventures: string[] = [];
        try {
          const recent = await db
            .select({ summary: schema.stories.summary })
            .from(schema.stories)
            .where(eq(schema.stories.childId, child.id))
            .orderBy(desc(schema.stories.createdAt))
            .limit(MEMORY_NIGHTS);
          previousAdventures = recent.map((r) => (r.summary ?? "").trim()).filter(Boolean);
        } catch { /* no memory yet — generate fresh */ }

        const animal = (child.animals && child.animals[0]) || undefined;
        const aboutLine = child.aboutText ? `About ${child.name}: ${child.aboutText}` : "";
        const avoidLine = child.avoidList && child.avoidList.length
          ? `NEVER include any of these (the child dislikes or fears them): ${child.avoidList.join(", ")}.`
          : "";
        const antiRepeat = previousAdventures.length
          ? `Do NOT repeat the plots of recent nights listed under continuity — tonight must be a fresh adventure, though familiar friends and places may return.`
          : "";

        const ctx = {
          profile: {
            name: child.name,
            age: child.age ?? undefined,
            interests: child.interests ?? [],
            colors: child.colors ?? [],
          },
          animal,
          customRequest: [aboutLine, avoidLine, antiRepeat].filter(Boolean).join("\n\n") || undefined,
          targetMinutes: 5,
          previousAdventures,
          recurringCharacters: child.recurringCharacters ?? [],
          weeklyTheme: child.weeklyTheme ?? undefined,
        };

        const raw = await generateStory(buildStoryPrompt(ctx as never));
        if (!raw) throw new Error("empty_generation");
        const { title, story } = splitTitle(raw);
        const finalTitle = title || "A Lullawood story";

        // Save (with tomorrow's memory).
        const summary = await summarizeStory(story, child.name);
        await db.insert(schema.stories).values({
          childId: child.id,
          title: finalTitle,
          body: story,
          summary: summary || null,
          isNightly: true,
        });
        succeeded += 1;

        // Deliver by email — best-effort. The story is already saved and waiting
        // in the dashboard even if the inbox delivery hiccups.
        const firstName = (sub.name || "").trim().split(/\s+/)[0] || "there";
        const emailRes = await sendNightlyStoryEmail(sub.email, firstName, child.name, finalTitle, story, dashboardUrl);
        results.push({ userId: sub.userId, childId: child.id, success: true, emailError: emailRes.success ? undefined : emailRes.error });
      } catch (err) {
        failed += 1;
        results.push({ userId: sub.userId, childId: child.id, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return NextResponse.json({ ok: true, total, succeeded, failed, skipped, results });
}
