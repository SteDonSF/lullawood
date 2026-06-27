// =============================================================================
// /api/generate-story  —  TWO modes, one engine.
// -----------------------------------------------------------------------------
// MODE A (authenticated, NEW): body has { childId }. A logged-in parent generates
//   a story FROM a saved child profile. We load the child (ownership-checked via
//   session), map its saved fields into the StoryContext the prompt builder
//   already understands, generate, and return { story, title }.
// MODE B (anonymous demo, UNCHANGED): no childId. The original public-demo path —
//   IP-rate-limited, fields come straight from the request body. Untouched so the
//   marketing demo keeps working exactly as before.
//
// WHY a branch (not two routes): the prompt builder (lib/story/prompt.ts) and the
//   model call (lib/anthropic.ts) are shared. Only the INPUT differs (saved
//   profile vs. anonymous body) and the LIMIT differs (per-user vs. per-IP).
//
// LULLAWOOD-FUTURE (Phase 3 memory): in MODE A, after generating, SAVE the story
//   + a one-line summary to schema.stories (childId), and BEFORE generating, load
//   the child's recent summaries into ctx.previousAdventures + recurringCharacters.
//   The builder already accepts both — this is the spot that switches "remember" on.
// LULLAWOOD-FUTURE (Phase 5 Stripe): gate MODE A behind an active subscription/
//   trial before generating.
// LULLAWOOD-FUTURE: per-user rate limiting in MODE A is a soft guard (10/hr) to
//   prevent runaway cost; revisit once plans/limits are defined.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { generateStory } from "@/lib/anthropic";
import { buildStoryPrompt } from "@/lib/story/prompt";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "edge";

const LIMIT = 5;            // demo: max generations
const WINDOW_MIN = 60;      // demo: per this many minutes, per visitor
const USER_LIMIT = 10;      // authed: soft per-user cap per hour (cost guard)

// One-way hash of the IP — lets us count repeat visitors without storing the address.
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

// Split the model output ("Title\n\nbody…") into { title, story } for the app UI.
// (The demo returns the raw string; the authed UI shows title separately.)
function splitTitle(raw: string): { title: string; story: string } {
  const trimmed = raw.trimStart();
  const nl = trimmed.indexOf("\n");
  if (nl === -1) return { title: "", story: trimmed };
  const title = trimmed.slice(0, nl).trim();
  const story = trimmed.slice(nl).trim();
  return { title, story };
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // ---------- MODE A: authenticated, from a saved child ----------
  if (body && (body as any).childId) {
    const user = await getSessionUser(req.headers);
    if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const childId = String((body as any).childId);

    // Load the child — ownership-checked (id AND parentId from the session).
    const [child] = await db
      .select()
      .from(schema.children)
      .where(and(eq(schema.children.id, childId), eq(schema.children.parentId, user.id)))
      .limit(1);
    if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

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
    } catch {
      // fail open — never block a real parent over a logging hiccup.
    }

    // Map the SAVED profile into the StoryContext the builder already understands.
    // animals[0] is the structured favourite companion (maps to a character bible).
    const animal = (child.animals && child.animals[0]) || undefined;
    const ctx = {
      profile: {
        name: child.name,
        age: child.age ?? undefined,
        interests: child.interests ?? [],
        colors: child.colors ?? [],
      },
      animal,
      // The living portrait + the avoid-list ride in as the parent's own words,
      // so the engine honours them (avoid-list framed as a hard constraint).
      customRequest: [
        child.aboutText ? `About ${child.name}: ${child.aboutText}` : "",
        (child.avoidList && child.avoidList.length)
          ? `NEVER include any of these (the child dislikes or fears them): ${child.avoidList.join(", ")}.`
          : "",
      ].filter(Boolean).join("\n\n") || undefined,
      targetMinutes: cleanMinutes((body as any).targetMinutes, 5),
      // LULLAWOOD-FUTURE: load these from saved stories to switch on memory.
      // recurringCharacters: [...], previousAdventures: [...],
    };

    try {
      const raw = await generateStory(buildStoryPrompt(ctx as any));
      if (!raw) throw new Error("empty");
      const { title, story } = splitTitle(raw);
      // LULLAWOOD-FUTURE (Phase 3): persist here —
      //   await db.insert(schema.stories).values({ childId, title, body: story, summary });
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
  } catch {
    // fail open
  }

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