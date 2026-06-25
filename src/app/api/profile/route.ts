import { NextRequest, NextResponse } from "next/server";
// import { getDb, schema } from "@/lib/db";

export const runtime = "edge";

// First-story onboarding writes the child profile here.
// Wired as a typed stub: enable the db import + insert when DATABASE_URL is set.
export async function POST(req: NextRequest) {
  const body = await req.json();
  // const db = getDb();
  // const [parent] = await db.insert(schema.parents).values({ email: body.email }).returning();
  // await db.insert(schema.children).values({ parentId: parent.id, name: body.name, ... });
  return NextResponse.json({ ok: true, received: body, note: "stub — wire DB to persist" });
}
