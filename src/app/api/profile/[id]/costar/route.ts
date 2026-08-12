// =============================================================================
// PATCH /api/profile/[id]/costar  —  set/clear a child's weekly co-star sibling
// -----------------------------------------------------------------------------
// WHAT: writes children.co_star_preference for the child [id]. The Friday nightly
//   cron reads this and generates one shared story for the pair automatically.
// BODY: { coStarChildId: string | null }  (null clears the preference)
// SECURITY: session-scoped. Both the child [id] AND the chosen co-star must
//   belong to the logged-in parent — fail closed otherwise.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { and, eq } from "drizzle-orm";

export const runtime = "edge";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const raw = (body as { coStarChildId?: unknown }).coStarChildId;
  const coStarChildId = raw == null || raw === "" ? null : String(raw);

  const db = getDb();

  // This child must belong to the session parent.
  const [child] = await db
    .select({ id: schema.children.id })
    .from(schema.children)
    .where(and(eq(schema.children.id, id), eq(schema.children.parentId, user.id)))
    .limit(1);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If setting a co-star, it must be a DIFFERENT child of the SAME parent.
  if (coStarChildId) {
    if (coStarChildId === id) {
      return NextResponse.json({ error: "cannot_costar_self" }, { status: 400 });
    }
    const [cs] = await db
      .select({ id: schema.children.id })
      .from(schema.children)
      .where(and(eq(schema.children.id, coStarChildId), eq(schema.children.parentId, user.id)))
      .limit(1);
    if (!cs) return NextResponse.json({ error: "costar_not_found" }, { status: 404 });
  }

  await db
    .update(schema.children)
    .set({ coStarPreference: coStarChildId })
    .where(and(eq(schema.children.id, id), eq(schema.children.parentId, user.id)));

  return NextResponse.json({ success: true });
}
