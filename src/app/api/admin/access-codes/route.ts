import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const runtime = "edge";

// Defense in depth: this route lives behind the Cloudflare Access wall on
// /api/admin (verified in the Access app). But because it MINTS FREE ACCESS,
// we also refuse any request that didn't arrive through Access — Cloudflare
// injects this header only on requests that passed the wall. A direct hit that
// somehow bypassed the edge (misconfig, future policy edit) is rejected here.
function passedAccess(req: Request): boolean {
  return !!req.headers.get("Cf-Access-Jwt-Assertion");
}

// GET — list all codes (newest first) for the admin dashboard.
export async function GET(req: Request) {
  if (!passedAccess(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(schema.accessCodes)
      .orderBy(desc(schema.accessCodes.createdAt));
    return NextResponse.json({ codes: rows });
  } catch {
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

// POST — mint a new code. Body: { label?, maxRedemptions?, expiresInDays? }
export async function POST(req: Request) {
  if (!passedAccess(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let label = "";
  let maxRedemptions = 1;
  let expiresInDays: number | null = null;
  try {
    const body = (await req.json()) as {
      label?: string;
      maxRedemptions?: number;
      expiresInDays?: number;
    };
    label = (body.label ?? "").trim();
    if (typeof body.maxRedemptions === "number" && body.maxRedemptions > 0) {
      maxRedemptions = Math.floor(body.maxRedemptions);
    }
    if (typeof body.expiresInDays === "number" && body.expiresInDays > 0) {
      expiresInDays = Math.floor(body.expiresInDays);
    }
  } catch {
    // Empty/invalid body is fine — fall back to defaults (1 redemption, no expiry).
  }

  // Human-friendly, unambiguous code: LULLA-XXXXXX (no 0/O/1/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) suffix += alphabet[bytes[i] % alphabet.length];
  const code = `LULLA-${suffix}`;

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const db = getDb();
  try {
    const [created] = await db
      .insert(schema.accessCodes)
      .values({ code, label: label || null, maxRedemptions, expiresAt })
      .returning();
    return NextResponse.json({ ok: true, code: created });
  } catch {
    return NextResponse.json({ error: "mint_failed" }, { status: 500 });
  }
}