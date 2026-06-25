import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";

export const runtime = "edge";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  let email = "", source = "";
  try { const b = await req.json(); email = (b.email || "").trim().toLowerCase(); source = (b.source || "").toString().slice(0, 40); } catch {}
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });

  if (!process.env.DATABASE_URL) return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });

  try {
    await getDb().insert(schema.waitlist).values({ email, source }).onConflictDoNothing();
    if (process.env.RESEND_API_KEY && process.env.WAITLIST_NOTIFY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || "Lullawood <onboarding@resend.dev>",
            to: process.env.WAITLIST_NOTIFY,
            subject: "New Lullawood waitlist signup",
            text: `${email}${source ? ` (from ${source})` : ""}`,
          }),
        });
      } catch {}
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
