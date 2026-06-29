// =============================================================================
// /api/subscription  —  Read the logged-in parent's subscription state.
// -----------------------------------------------------------------------------
// WHAT: GET returns { hasAccess, plan, status, trialEnd } for the dashboard to
//   show "Family plan, trial ends Jul 5" + the right button. Read-only.
// SECURITY: parent resolved from the server session; never trust the browser.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = getDb();
  const [sub] = await db
    .select({
      plan: schema.subscriptions.plan,
      status: schema.subscriptions.status,
      trialEnd: schema.subscriptions.trialEnd,
      currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: schema.subscriptions.cancelAtPeriodEnd,
    })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, user.id))
    .limit(1);

  if (!sub) {
    return NextResponse.json({ hasAccess: false, plan: null, status: null });
  }

  const hasAccess = sub.status === "trialing" || sub.status === "active";
  return NextResponse.json({
    hasAccess,
    plan: sub.plan,
    status: sub.status,
    trialEnd: sub.trialEnd,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  });
}