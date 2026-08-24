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
import { generateStory, summarizeStory, streamStory } from "@/lib/anthropic";
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

// Product-health logging. Writes one row to api_events for the outcomes the
// admin dashboard reports on — 402s, 429s, 5xx — plus a latency sample on the
// authenticated success path. Best-effort and awaited nowhere near the response
// path's critical section: a logging failure must never cost a parent a story.
async function logApiEvent(
  db: ReturnType<typeof getDb>,
  status: number,
  opts: { userId?: string | null; detail?: string; durationMs?: number } = {}
): Promise<void> {
  try {
    await db.insert(schema.apiEvents).values({
      route: "generate-story",
      status,
      durationMs: opts.durationMs ?? null,
      userId: opts.userId ?? null,
      detail: opts.detail ?? null,
    });
  } catch {
    /* the log is diagnostics, never a dependency */
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const startedAt = Date.now();
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
      await logApiEvent(db, 402, { userId: user.id, detail: "no_subscription" });
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
        await logApiEvent(db, 429, { userId: user.id, detail: "user_rate_limit" });
        return NextResponse.json(
          { error: "rate_limited", message: "You've made a lot of stories in the last hour — give it a little while." },
          { status: 429 }
        );
      }
    } catch { /* fail open */ }

    // ----- Optional co-star (Family-tier sibling story) -----
    // Fail CLOSED: a co-star is honoured only if it's another child of the SAME
    // parent. A stranger's childId (or the same child) is rejected/ignored.
    const coStarChildId = (body as any).coStarChildId ? String((body as any).coStarChildId) : "";
    let coStar: typeof child | null = null;
    if (coStarChildId && coStarChildId !== childId) {
      const [cs] = await db
        .select()
        .from(schema.children)
        .where(and(eq(schema.children.id, coStarChildId), eq(schema.children.parentId, user.id)))
        .limit(1);
      if (!cs) return NextResponse.json({ error: "costar_not_found" }, { status: 404 });
      coStar = cs;
    }

    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.map((s) => (s ?? "").trim()).filter(Boolean)));

    // ----- RETRIEVE memory: last 3 from EACH hero on a co-star night (6 total),
    // else the usual rolling window for a solo story. -----
    let previousAdventures: string[] = [];
    try {
      const mine = await db
        .select({ summary: schema.stories.summary })
        .from(schema.stories)
        .where(eq(schema.stories.childId, childId))
        .orderBy(desc(schema.stories.createdAt))
        .limit(coStar ? 3 : MEMORY_NIGHTS);
      previousAdventures = mine.map((r) => (r.summary ?? "").trim()).filter(Boolean);
      if (coStar) {
        const theirs = await db
          .select({ summary: schema.stories.summary })
          .from(schema.stories)
          .where(eq(schema.stories.childId, coStar.id))
          .orderBy(desc(schema.stories.createdAt))
          .limit(3);
        previousAdventures = [...previousAdventures, ...theirs.map((r) => (r.summary ?? "").trim()).filter(Boolean)];
      }
    } catch { /* no memory yet, or read hiccup — generate fresh */ }

    // On a co-star night, MERGE the two profiles (union of interests/colours/
    // avoid-lists/companions/recurring cast); else use the single child's.
    const interests = coStar ? uniq([...(child.interests ?? []), ...(coStar.interests ?? [])]) : (child.interests ?? []);
    const colors = coStar ? uniq([...(child.colors ?? []), ...(coStar.colors ?? [])]) : (child.colors ?? []);
    const avoidAll = coStar ? uniq([...(child.avoidList ?? []), ...(coStar.avoidList ?? [])]) : (child.avoidList ?? []);
    const animalsAll = coStar ? uniq([...(child.animals ?? []), ...(coStar.animals ?? [])]) : (child.animals ?? []);
    const recurring = coStar ? uniq([...(child.recurringCharacters ?? []), ...(coStar.recurringCharacters ?? [])]) : (child.recurringCharacters ?? []);
    const animal = animalsAll[0] || undefined;

    const coStarLine = coStar
      ? `Tonight is a co-star story. Both ${child.name} and ${coStar.name} are heroes of equal importance. Write them as a genuine team — their dynamic, their banter, their complementary strengths, their shared triumph. Neither overshadows the other. Both must be present throughout.`
      : "";
    const bothAnimalsLine = coStar && animalsAll.length > 1
      ? `Both companions appear together in the story: ${animalsAll.join(" and ")}.`
      : "";
    const aboutLine = child.aboutText ? `About ${child.name}: ${child.aboutText}` : "";
    const coStarAboutLine = coStar && coStar.aboutText ? `About ${coStar.name}: ${coStar.aboutText}` : "";
    const avoidLine = avoidAll.length
      ? `NEVER include any of these (a hero dislikes or fears them): ${avoidAll.join(", ")}.`
      : "";
    // Anti-repetition is explicit: the builder shows previousAdventures as
    // continuity; we also tell it plainly not to repeat them.
    const antiRepeat = previousAdventures.length
      ? `Do NOT repeat the plots of recent nights listed under continuity — tonight must be a fresh adventure, though familiar friends and places may return.`
      : "";

    const tonight = String((body as any).adventure ?? "").trim().slice(0, 500);
    const tonightLine = tonight ? `Tonight's request from the parent: ${tonight}` : "";

    const ctx = {
      profile: {
        name: child.name,
        age: child.age ?? undefined,
        interests,
        colors,
      },
      costar: coStar ? { name: coStar.name, age: coStar.age ?? undefined } : undefined,
      animal,
      customRequest: [tonightLine, coStarLine, aboutLine, coStarAboutLine, avoidLine, bothAnimalsLine, antiRepeat].filter(Boolean).join("\n\n") || undefined,
      targetMinutes: cleanMinutes((body as any).targetMinutes, 5),
      previousAdventures,                                  // <- the memory, fed in
      recurringCharacters: recurring,                       // threaded for durable layer
    };

    // STREAM the story text so the first words reach the parent in ~1-2s instead
    // of a ~20s blank wait. The memory loop (summarise + save) runs on the full
    // accumulated text, before the stream closes, so it reliably fires.
    const encoder = new TextEncoder();
    let full = "";
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let got = false;
        try {
          for await (const delta of streamStory(buildStoryPrompt(ctx as any))) {
            if (!delta) continue;
            got = true;
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
          if (!got) throw new Error("empty");

          // ----- SAVE + memory: split title, summarise, store the finished story.
          // Runs on the full text before close(); summary is best-effort. -----
          const { title, story } = splitTitle(full);
          const finalTitle = title || "A Lullawood story";
          const summary = await summarizeStory(story, coStar ? `${child.name} and ${coStar.name}` : child.name);
          try {
            if (coStar) {
              // Co-star night: ONE story, saved to BOTH libraries — each row
              // points at the other child, and both share a pair id.
              const sharedId = crypto.randomUUID();
              await db.insert(schema.stories).values([
                { childId: child.id, title: finalTitle, body: story, summary: summary || null, coStarChildId: coStar.id, sharedStoryId: sharedId },
                { childId: coStar.id, title: finalTitle, body: story, summary: summary || null, coStarChildId: child.id, sharedStoryId: sharedId },
              ]);
            } else {
              await db.insert(schema.stories).values({
                childId,
                title: finalTitle,
                body: story,
                summary: summary || null,
              });
            }
          } catch { /* never let a save hiccup break delivery */ }

          // Latency sample for the product-health panel's median. Measured to
          // the end of generation, which is what a parent actually waits for.
          await logApiEvent(db, 200, {
            userId: user.id,
            durationMs: Date.now() - startedAt,
            detail: coStar ? "costar" : "solo",
          });
          controller.close();
        } catch (err) {
          // The stream broke mid-generation. The client sees a truncated story;
          // the dashboard needs to see a failure.
          await logApiEvent(db, 500, {
            userId: user.id,
            durationMs: Date.now() - startedAt,
            detail: "stream_failed",
          });
          try { controller.error(err); } catch { /* already closed */ }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
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
      await logApiEvent(db, 429, { detail: "demo_ip_rate_limit" });
      return NextResponse.json(
        { error: "rate_limited", message: "You've created a few stories already — please try again a little later." },
        { status: 429 }
      );
    }
  } catch { /* fail open */ }

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

  // STREAM the story text as it's generated, so the first words reach the demo in
  // ~1-2s instead of a ~20s blank wait. Rate-limiting already ran above; the
  // demo_events log runs after the text finishes (inside the stream, before close).
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let got = false;
      try {
        for await (const delta of streamStory(prompt)) {
          if (!delta) continue;
          got = true;
          controller.enqueue(encoder.encode(delta));
        }
        if (!got) throw new Error("empty");
        try {
          await db.insert(schema.demoEvents).values({
            ipHash, childName: cleanName,
            animal: (animal || "").toString().slice(0, 40),
            adventure: (adventure || "").toString().slice(0, 40),
            color: (color || "").toString().slice(0, 40),
            ok: true,
          });
        } catch {}
        controller.close();
      } catch (err) {
        try { await db.insert(schema.demoEvents).values({ ipHash, ok: false }); } catch {}
        try { controller.error(err); } catch {}
      }
    },
  });

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}