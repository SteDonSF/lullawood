import { NextResponse } from "next/server";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "edge";

// Reviewer redeems a code → writes a comp grant keyed to their user.id.
// Validates: code exists, active, not expired, under max redemptions.
// One active grant per user (no double-redeem).
export async function POST(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let code: string;
  try {
    const body = (await req.json()) as { code?: string };
    code = (body.code ?? "").trim();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!code) return NextResponse.json({ error: "missing_code" }, { status: 400 });

  const db = getDb();
  try {
    // 1. Look up the code (case-insensitive).
    const [row] = await db
      .select()
      .from(schema.accessCodes)
      .where(sql`lower(${schema.accessCodes.code}) = lower(${code})`)
      .limit(1);

    if (!row || !row.active) {
      return NextResponse.json({ error: "invalid_code" }, { status: 404 });
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
      return NextResponse.json({ error: "code_expired" }, { status: 410 });
    }
    if (row.redemptionsUsed >= row.maxRedemptions) {
      return NextResponse.json({ error: "code_used_up" }, { status: 409 });
    }

    // 2. Already have an active grant? Don't double-redeem.
    const [existing] = await db
      .select({ id: schema.accessGrants.id })
      .from(schema.accessGrants)
      .where(
        and(
          eq(schema.accessGrants.userId, user.id),
          eq(schema.accessGrants.active, true),
          or(
            isNull(schema.accessGrants.expiresAt),
            gt(schema.accessGrants.expiresAt, new Date()),
          ),
        ),
      )
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "already_has_access" }, { status: 409 });
    }

    // 3. Write the grant (60-day reviewer window) + bump the counter.
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await db.insert(schema.accessGrants).values({
      userId: user.id,
      codeId: row.id,
      source: "reviewer",
      plan: "family",
      active: true,
      expiresAt,
    });
    await db
      .update(schema.accessCodes)
      .set({ redemptionsUsed: row.redemptionsUsed + 1 })
      .where(eq(schema.accessCodes.id, row.id));

    return NextResponse.json({ ok: true, plan: "family", expiresAt });
  } catch {
    return NextResponse.json({ error: "redeem_failed" }, { status: 500 });
  }
}