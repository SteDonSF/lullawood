import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { generateStory } from "@/lib/anthropic";
import { buildStoryPrompt } from "@/lib/story/prompt";
import { getDb, schema } from "@/lib/db";
export const runtime = "edge";
const LIMIT = 5;           // max generations
const WINDOW_MIN = 60;     // per this many minutes, per visitor
// One-way hash of the IP — lets us count repeat visitors without storing the address.
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + "|lullawood");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
function cleanAge(v: unknown, fallback = 6): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(12, n));
}
export async function POST(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  const ipHash = await hashIp(ip);
  const db = getDb();
  // Rate-limit check: how many in the last window?
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
    // If the check fails, fail open (don't block a real visitor over a logging hiccup).
  }
  try {
    const { name, age, animal, adventure, color, customRequest, costar } = await req.json();
    const cleanName = (name || "a curious little one").toString().slice(0, 40);
    const childAge = cleanAge(age);
    const cleanCustom = customRequest ? customRequest.toString().slice(0, 600) : undefined;

    // Optional co-star (sibling/friend).
    let cleanCostar: { name: string; age?: number } | undefined;
    if (costar && typeof costar === "object" && costar.name && costar.name.toString().trim()) {
      cleanCostar = {
        name: costar.name.toString().slice(0, 40),
        age: cleanAge(costar.age, childAge),
      };
    }

    const prompt = buildStoryPrompt({
      profile: { name: cleanName, age: childAge },
      customRequest: cleanCustom,
      costar: cleanCostar,
      animal, adventure, color,
    });
    const story = await generateStory(prompt);
    if (!story) throw new Error("empty");
    // Log success (don't let a logging error break the response).
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
  } catch (e) {
    try { await db.insert(schema.demoEvents).values({ ipHash, ok: false }); } catch {}
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
