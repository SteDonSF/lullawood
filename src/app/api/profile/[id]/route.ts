// =============================================================================
// /api/profile/[id]  —  Fetch one child by id (Phase 2)
// -----------------------------------------------------------------------------
// WHAT: Returns a single child's full profile, but ONLY if it belongs to the
//   logged-in parent. The single-child view (/dashboard/children/[id]) reads this.
// SECURITY: scoped by BOTH child id AND the session user's id — a parent can
//   never read another family's child by guessing a uuid. parentId comes from
//   the server session (getSessionUser), never the browser.
// TALKS TO: getSessionUser (session) · getDb/schema (children table)
//
// LULLAWOOD-FUTURE: add PATCH (edit child) here when the single-child view grows
//   an "edit profile" affordance. Same ownership check as GET/DELETE applies.
//   Deleting a child cascades to their stories (FK onDelete).
// LULLAWOOD-FUTURE: when memory lands (Phase 3), this is a natural place to also
//   return the child's recent story summaries for the single-child view.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { and, desc, eq, gte } from "drizzle-orm";

export const runtime = "edge";

function startOfTodayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await params;

  const db = getDb();
  const [child] = await db
    .select()
    .from(schema.children)
    .where(and(eq(schema.children.id, id), eq(schema.children.parentId, user.id)))
    .limit(1);

  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Today's waiting nightly story (if the delivery cron has run for this child).
  // Powers the dashboard's "tonight's story is ready" state. Best-effort — a read
  // hiccup just falls back to the on-demand generate button.
  let todaysStory: { id: string; title: string; body: string } | null = null;
  try {
    const [row] = await db
      .select({ id: schema.stories.id, title: schema.stories.title, body: schema.stories.body })
      .from(schema.stories)
      .where(and(eq(schema.stories.childId, id), eq(schema.stories.isNightly, true), gte(schema.stories.createdAt, startOfTodayUTC())))
      .orderBy(desc(schema.stories.createdAt))
      .limit(1);
    if (row) todaysStory = row;
  } catch {
    /* no waiting story / read hiccup — dashboard shows the generate fallback */
  }

  return NextResponse.json({ child, todaysStory });
}

// Remove one child — ONLY if it belongs to the logged-in parent. Same ownership
// scoping as GET (child id AND session parentId), so a parent can never delete
// another family's child by guessing a uuid. Stories cascade via the FK.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await params;

  const db = getDb();
  const [deleted] = await db
    .delete(schema.children)
    .where(and(eq(schema.children.id, id), eq(schema.children.parentId, user.id)))
    .returning({ id: schema.children.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, id: deleted.id });
}