import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { validateAttribution } from "@/lib/attribution";

export const runtime = "edge";

// Persist first-touch attribution onto the parent's user row. Called once, by
// the signup page, immediately after the account is created.
//
// Trust model:
//  - WHO is derived server-side from the verified session. The browser never
//    names the row it is writing to.
//  - WHAT the browser sends is client-controlled and is scrubbed by
//    validateAttribution(): the source must be on the KNOWN_SOURCES allowlist
//    (anything else lands as 'other', a missing one as 'direct'), and the
//    campaign/landing values are charset- and length-limited.
//  - FIRST TOUCH is enforced in the UPDATE itself (`signup_source IS NULL`), so
//    a replayed or duplicate POST can never rewrite an existing attribution.
export async function POST(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* no body — falls through to 'direct' */
  }
  const attr = validateAttribution(body);

  try {
    const db = getDb();
    const written = await db
      .update(schema.user)
      .set({
        signupSource: attr.source,
        signupCampaign: attr.campaign,
        signupLanding: attr.landing,
      })
      .where(and(eq(schema.user.id, user.id), isNull(schema.user.signupSource)))
      .returning({ id: schema.user.id });

    return NextResponse.json({ ok: true, source: attr.source, written: written.length > 0 });
  } catch {
    // Attribution is a marketing nicety — never surface a failure that would
    // make a freshly created account look broken.
    return NextResponse.json({ error: "attribution_failed" }, { status: 500 });
  }
}
