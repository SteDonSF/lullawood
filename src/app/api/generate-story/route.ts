// =============================================================================
// /api/generate-story  —  TWO modes, one engine.  (+ episodic memory in Mode A)
// -----------------------------------------------------------------------------
// MODE A (authenticated): body has { childId }. Generate FROM a saved child
//   profile. NOW WITH MEMORY: before generating we load the child's recent story
//   summaries and feed them in (continuity + anti-repetition); after generating
//   we save the story and a one-line summary, so tomorrow remembers tonight.
// MODE B (anonymous demo, UNCHANGED): no childId. Original public-demo path.
//
// THE MEMORY LOOP (episodic):
//   retrieve last N summaries -> previousAdventures -> generate ->
//   save story -> summarise -> save summary.  Schema was built for this
//   (stories.summary). recurringCharacters is also threaded for later.
//
// LULLAWOOD-FUTURE (durable / semantic memory — "growth & aging"): episodic
//   memory above is a ROLLING WINDOW of recent nights. The durable layer is a
//   DISTILLATION of the whole history into an evolving portrait (the child's
//   changing interests, the cast's deepening relationships, recurring rivals)
//   that must be RE-distilled over time, not just appended — so things can fade,
//   not only accumulate (avoid ossifying "loves dinosaurs" forever). Build it as
//   a periodic step that writes a durable field on the child and loads it here
//   alongside previousAdventures. THIS is where character aging lives.
// LULLAWOOD-FUTURE (Phase 5 Stripe): gate Mode A behind an active subscription/trial.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and, desc } from "drizzle-orm";
import { generateStory, summarizeStory } from "@/lib/anthropic";
import { buildStoryPrompt } from "@/lib/story/prompt";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { getAccess } from "@/lib/subscription";

export const runtime = "edge";

const LIMIT = 20;           // demo: max generations per IP/hour (cost is negligible; this only blunts scripted abuse)
const WINDOW_MIN = 60;      // demo: per this many minutes, per visitor
const USER_LIMIT = 30;      // authed: soft per-user cap per hour (logged-in users get more rope than anon demo)
const MEMORY_NIGHTS = 6;    // how many recent summaries feed tonight's story

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + "|lullawood");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
function cleanAge(v: unknown, fallback = 6): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(12, n));
}
function cleanMinutes(v: unknown, fallback = 5): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(10, n));
}
function splitTitle(raw: string): { title: string; story: string } {
  const trimmed = raw.trimStart();
  const nl = trimmed.indexOf("\n");
  if (nl === -1) return { title: "", story: trimmed };
  return { title: trimmed.slice(0, nl).trim(), story: trimmed.slice(nl).trim() };
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // ---------- MODE A: authenticated, from a saved child (+ memory) ----------
  if (body && (body as any).childId) {
    const user = await getSessionUser(req.headers);
    if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const childId = String((body as any).childId);

    const [child] = await db
      .select()
      .from(schema.children)
      .where(and(eq(schema.children.id, childId), eq(schema.children.parentId, user.id)))
      .limit(1);
    if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });
    
    // GATE: require an active trial or subscription to generate (Phase 5).
    const access = await getAccess(user.id);
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "no_subscription", message: "Start a free trial to generate stories." },
        { status: 402 }
      );
    }
    
    // Soft per-user rate limit (cost guard).
    try {
      const rows = await db.execute(
        sql`select count(*)::int as n from stories s
            join children c on c.id = s.child_id
            where c.parent_id = ${user.id}
            and s.created_at > now() - interval '${sql.raw(String(WINDOW_MIN))} minutes'`
      );
      const used = Number((rows.rows?.[0] as any)?.n ?? 0);
      if (used >= USER_LIMIT) {
        return NextResponse.json(
          { error: "rate_limited", message: "You've made a lot of stories in the last hour — give it a little while." },
          { status: 429 }
        );
      }
    } catch { /* fail open */ }

    // ----- RETRIEVE: recent summaries for continuity + anti-repetition -----
    let previousAdventures: string[] = [];
    try {
      const recent = await db
        .select({ summary: schema.stories.summary })
        .from(schema.stories)
        .where(eq(schema.stories.childId, childId))
        .orderBy(desc(schema.stories.createdAt))
        .limit(MEMORY_NIGHTS);
      previousAdventures = recent
        .map((r) => (r.summary ?? "").trim())
        .filter(Boolean);
    } catch { /* no memory yet, or read hiccup — generate fresh */ }

    const animal = (child.animals && child.animals[0]) || undefined;
    const aboutLine = child.aboutText ? `About ${child.name}: ${child.aboutText}` : "";
    const avoidLine = (child.avoidList && child.avoidList.length)
      ? `NEVER include any of these (the child dislikes or fears them): ${child.avoidList.join(", ")}.`
      : "";
    // Anti-repetition is explicit: the builder shows previousAdventures as
    // continuity; we also tell it plainly not to repeat them.
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
      targetMinutes: cleanMinutes((body as any).targetMinutes, 5),
      previousAdventures,                                  // <- the memory, fed in
      recurringCharacters: child.recurringCharacters ?? [], // threaded for durable layer
    };

    try {
      const raw = await generateStory(buildStoryPrompt(ctx as any));
      if (!raw) throw new Error("empty");
      const { title, story } = splitTitle(raw);

      // ----- SAVE: store the story, then summarise for tomorrow -----
      // Summary is best-effort (helper swallows its own errors); we still save
      // the story even if the summary comes back empty.
      const summary = await summarizeStory(story, child.name);
      try {
        await db.insert(schema.stories).values({
          childId,
          title: title || "A Lullawood story",
          body: story,
          summary: summary || null,
        });
      } catch { /* never let a save hiccup break delivery */ }

      return NextResponse.json({ story, title });
    } catch {
      return NextResponse.json({ error: "generation_failed" }, { status: 500 });
    }
  }

  // ---------- MODE B: anonymous demo (UNCHANGED behaviour) ----------
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  const ipHash = await hashIp(ip);

  try {
    const rows = await db.execute(
      sql`select count(*)::int as n from demo_events
          where ip_hash = ${ipHash}
          and created_at > now() - interval '${sql.raw(String(WINDOW_MIN))} minutes'`
    );
    const used = Number((rows.rows?.[0] as any)?.n ?? 0);
    if (used >= LIMIT) {
      return NextResponse.json(
        { error: "rate_limited", message: "You've created a few stories already — please try again a little later." },
        { status: 429 }
      );
    }
  } catch { /* fail open */ }

  try {
    const { name, age, animal, adventure, color, targetMinutes, customRequest, costar } = body as any;
    const cleanName = (name || "a curious little one").toString().slice(0, 40);
    const childAge = cleanAge(age);
    const minutes = cleanMinutes(targetMinutes);
    const cleanCustom = customRequest ? customRequest.toString().slice(0, 600) : undefined;

    let cleanCostar: { name: string; age?: number } | undefined;
    if (costar && typeof costar === "object" && costar.name && costar.name.toString().trim()) {
      cleanCostar = { name: costar.name.toString().slice(0, 40), age: cleanAge(costar.age, childAge) };
    }

    const prompt = buildStoryPrompt({
      profile: { name: cleanName, age: childAge },
      targetMinutes: minutes,
      customRequest: cleanCustom,
      costar: cleanCostar,
      animal, adventure, color,
    });
    const story = await generateStory(prompt);
    if (!story) throw new Error("empty");

    try {
      await db.insert(schema.demoEvents).values({
        ipHash, childName: cleanName,
        animal: (animal || "").toString().slice(0, 40),
        adventure: (adventure || "").toString().slice(0, 40),
        color: (color || "").toString().slice(0, 40),
        ok: true,
      });
    } catch {}

    return NextResponse.json({ story });
  } catch {
    try { await db.insert(schema.demoEvents).values({ ipHash, ok: false }); } catch {}
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}