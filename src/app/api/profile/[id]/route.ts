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
import { and, eq } from "drizzle-orm";

export const runtime = "edge";

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

  return NextResponse.json({ child });
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