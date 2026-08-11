// =============================================================================
// /api/stories/[childId]  —  the child's story library (paginated)
// -----------------------------------------------------------------------------
// WHAT: Returns all stories for one child, newest first, for the library page.
// SECURITY: ownership-scoped — the child must belong to the logged-in parent, so
//   a parent can never read another family's library by guessing a uuid.
// PAGINATION: ?page=1&limit=20. Also returns `total` so the UI can show
//   "See all N stories" and page through a long history.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { and, desc, eq, sql } from "drizzle-orm";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { childId } = await params;
  const db = getDb();

  // Ownership: this child must belong to the session parent.
  const [child] = await db
    .select({ id: schema.children.id, name: schema.children.name })
    .from(schema.children)
    .where(and(eq(schema.children.id, childId), eq(schema.children.parentId, user.id)))
    .limit(1);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.stories)
    .where(eq(schema.stories.childId, childId));

  const stories = await db
    .select({
      id: schema.stories.id,
      title: schema.stories.title,
      summary: schema.stories.summary,
      body: schema.stories.body,
      createdAt: schema.stories.createdAt,
      isNightly: schema.stories.isNightly,
    })
    .from(schema.stories)
    .where(eq(schema.stories.childId, childId))
    .orderBy(desc(schema.stories.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ childName: child.name, stories, total, page, limit });
}
