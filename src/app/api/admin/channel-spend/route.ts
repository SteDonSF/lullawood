// =============================================================================
// /api/admin/channel-spend  —  manual monthly ad spend entry.
// -----------------------------------------------------------------------------
// Meta's Marketing API needs app review before it hands over spend, so this
// number is typed in once a month on the dashboard. One row per (source, month);
// re-submitting the same pair overwrites rather than duplicating.
// SECURITY: requireAccess() on both verbs — same wall as the rest of /api/admin.
// =============================================================================
import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { KNOWN_SOURCES } from "@/lib/attribution";

export const runtime = "edge";

// Sources you can file spend against: the marketing allowlist, plus the two
// synthetic buckets that appear in the channel table.
const SPEND_SOURCES = new Set<string>([...KNOWN_SOURCES, "other", "direct"]);

export async function GET(req: Request) {
  const gate = await requireAccess(req);
  if (!gate.ok) return NextResponse.json({ error: "forbidden", reason: gate.reason }, { status: gate.status });

  try {
    const db = getDb();
    const spend = await db
      .select()
      .from(schema.channelSpend)
      .orderBy(desc(schema.channelSpend.month), schema.channelSpend.source);
    return NextResponse.json({ spend, sources: [...SPEND_SOURCES].sort() });
  } catch {
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAccess(req);
  if (!gate.ok) return NextResponse.json({ error: "forbidden", reason: gate.reason }, { status: gate.status });

  let source = "";
  let month = "";
  let amountCents = 0;
  let note: string | null = null;
  try {
    const body = (await req.json()) as {
      source?: string;
      month?: string;
      amount?: number | string;
      note?: string;
    };
    source = (body.source ?? "").trim().toLowerCase();
    month = (body.month ?? "").trim();
    // The form collects dollars; cents is what we store.
    const raw = typeof body.amount === "string" ? parseFloat(body.amount) : body.amount ?? 0;
    const dollars = Number.isFinite(raw) ? Number(raw) : 0;
    amountCents = Math.round(dollars * 100);
    note = (body.note ?? "").trim().slice(0, 200) || null;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!SPEND_SOURCES.has(source)) {
    return NextResponse.json({ error: "unknown_source" }, { status: 400 });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "bad_month", message: "Use YYYY-MM." }, { status: 400 });
  }
  if (amountCents < 0) {
    return NextResponse.json({ error: "bad_amount" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: schema.channelSpend.id })
      .from(schema.channelSpend)
      .where(and(eq(schema.channelSpend.source, source), eq(schema.channelSpend.month, month)))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.channelSpend)
        .set({ amountCents, note, updatedAt: new Date() })
        .where(eq(schema.channelSpend.id, existing.id))
        .returning();
      return NextResponse.json({ ok: true, row: updated, replaced: true });
    }

    const [created] = await db
      .insert(schema.channelSpend)
      .values({ source, month, amountCents, note })
      .returning();
    return NextResponse.json({ ok: true, row: created, replaced: false });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
