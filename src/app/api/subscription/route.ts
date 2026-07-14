// =============================================================================
// /api/subscription  —  Read the logged-in parent's access + plan for the dashboard.
// -----------------------------------------------------------------------------
// WHAT: GET returns { hasAccess, plan, status, trialEnd, ... } so the dashboard
//   shows the right plan card + button.
// ACCESS IS AUTHORITATIVE FROM getAccess(): it is the single source of truth for
//   access and honors reviewer comp grants AS WELL AS Stripe subscriptions.
//   (The old bug read the subscriptions table directly, so reviewer-grant
//   accounts — which getAccess() grants Family access — showed "No active plan".)
// The Stripe-only DISPLAY fields (trialEnd / currentPeriodEnd / cancelAtPeriodEnd)
//   still come from the subscriptions row when one exists; they are null for
//   reviewer grants (no Stripe row) and are presentational only.
// SECURITY: parent resolved from the server session; never trust the browser.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { getAccess } from "@/lib/subscription";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Authoritative access — same source of truth as story gating (reviewer grants + Stripe).
  const access = await getAccess(user.id);

  // Stripe-only presentational fields (trial countdown, cancel notice). Null for
  // reviewer grants, which have no Stripe subscription row.
  let trialEnd: Date | null = null;
  let currentPeriodEnd: Date | null = null;
  let cancelAtPeriodEnd: boolean | null = null;
  try {
    const db = getDb();
    const [sub] = await db
      .select({
        trialEnd: schema.subscriptions.trialEnd,
        currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: schema.subscriptions.cancelAtPeriodEnd,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, user.id))
      .limit(1);
    if (sub) {
      trialEnd = sub.trialEnd;
      currentPeriodEnd = sub.currentPeriodEnd;
      cancelAtPeriodEnd = sub.cancelAtPeriodEnd;
    }
  } catch {
    // Display-only fields — ignore on failure; the access above is what matters.
  }

  return NextResponse.json({
    hasAccess: access.hasAccess,
    plan: access.plan,
    status: access.status,
    trialEnd,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  });
}
