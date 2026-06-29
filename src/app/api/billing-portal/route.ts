// =============================================================================
// /api/billing-portal  —  Send a parent to Stripe's hosted billing portal.
// -----------------------------------------------------------------------------
// WHAT: Creates a Stripe Billing Portal session for the logged-in parent so they
//   can manage or CANCEL their subscription themselves. Returns the URL to
//   redirect to. This is the self-serve cancel path — essential before charging.
// SECURITY: parent resolved from the server session; we look up THEIR
//   stripeCustomerId from the subscriptions table. Never trust the browser.
//
// LULLAWOOD-FUTURE: the portal's allowed actions (cancel, switch plan, update
//   card) are configured in the Stripe Dashboard > Billing > Customer portal.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "edge";

const APP_URL = process.env.BETTER_AUTH_URL || "https://lullawood.com";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = getDb();
  const [sub] = await db
    .select({ customerId: schema.subscriptions.stripeCustomerId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, user.id))
    .limit(1);

  if (!sub?.customerId) {
    return NextResponse.json({ error: "No subscription to manage" }, { status: 404 });
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.customerId,
    return_url: `${APP_URL}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}