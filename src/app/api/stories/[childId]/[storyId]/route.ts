// =============================================================================
// /api/stories/[childId]/[storyId]  —  one story from the library
// -----------------------------------------------------------------------------
// WHAT: Returns a single saved story for the story-detail reader page.
// SECURITY: doubly scoped — the child must belong to the session parent AND the
//   story must belong to that child. A parent can never read another family's
//   story by guessing uuids.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { and, eq } from "drizzle-orm";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ childId: string; storyId: string }> }
) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { childId, storyId } = await params;
  const db = getDb();

  // Ownership: this child must belong to the session parent.
  const [child] = await db
    .select({ id: schema.children.id, name: schema.children.name })
    .from(schema.children)
    .where(and(eq(schema.children.id, childId), eq(schema.children.parentId, user.id)))
    .limit(1);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [story] = await db
    .select({
      id: schema.stories.id,
      title: schema.stories.title,
      summary: schema.stories.summary,
      body: schema.stories.body,
      createdAt: schema.stories.createdAt,
      isNightly: schema.stories.isNightly,
    })
    .from(schema.stories)
    .where(and(eq(schema.stories.id, storyId), eq(schema.stories.childId, childId)))
    .limit(1);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ childName: child.name, story });
}
