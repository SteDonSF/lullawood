import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { eq, desc } from "drizzle-orm";
import { getAccess } from "@/lib/subscription";

export const runtime = "edge";

// List the logged-in parent's children.
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = getDb();
  const kids = await db
    .select()
    .from(schema.children)
    .where(eq(schema.children.parentId, user.id))
    .orderBy(desc(schema.children.createdAt));

  return NextResponse.json({ children: kids });
}

// Create a child for the logged-in parent.
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json();

  const name = (body.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  // Enforce the per-plan child cap (Phase 5). No active plan -> maxChildren 0.
  const access = await getAccess(user.id);
  if (!access.hasAccess) {
    return NextResponse.json(
      { error: "no_subscription", message: "Start a free trial to add a child." },
      { status: 402 }
    );
  }
  {
    const db0 = getDb();
    const existing = await db0
      .select({ id: schema.children.id })
      .from(schema.children)
      .where(eq(schema.children.parentId, user.id));
    if (existing.length >= access.maxChildren) {
      return NextResponse.json(
        {
          error: "child_limit",
          message:
            access.plan === "dreamer"
              ? "The Dreamer plan includes one child. Upgrade to Family to add more."
              : `Your plan includes up to ${access.maxChildren} children.`,
        },
        { status: 403 }
      );
    }
  }

  const age =
    body.age === null || body.age === undefined || body.age === ""
      ? null
      : Math.max(0, Math.min(18, parseInt(body.age, 10) || 0));

  const toArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean)
      : typeof v === "string"
      ? v.split(",").map((x) => x.trim()).filter(Boolean)
      : [];

  const db = getDb();
  const [child] = await db
    .insert(schema.children)
    .values({
      parentId: user.id,
      name,
      age,
      interests: toArray(body.interests),
      animals: toArray(body.animals),
      avoidList: toArray(body.avoidList),
      aboutText: (body.aboutText ?? "").toString().trim() || null,
    })
    .returning();

  return NextResponse.json({ child });
}