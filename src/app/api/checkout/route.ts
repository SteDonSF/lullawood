// =============================================================================
// /api/checkout  —  Create a Stripe Checkout session for the chosen plan.
// -----------------------------------------------------------------------------
// WHAT: A logged-in parent picks plan + interval; we create (or reuse) their
//   Stripe customer, open a subscription Checkout session with the 7-day trial,
//   and return the hosted-payment URL for the browser to redirect to.
// SECURITY: the parent is resolved from the SERVER session, never the browser.
//   The user id is stored on the Stripe customer + session metadata so the
//   webhook can tie the resulting subscription back to the right parent.
// TALKS TO: getSessionUser · getStripe/priceId · subscriptions table (to reuse
//   an existing stripeCustomerId if we have one).
//
// LULLAWOOD-FUTURE: founding-family pricing -> pass a coupon/promotion code here.
// LULLAWOOD-FUTURE: if the parent already has an active sub, send them to the
//   billing portal (manage/upgrade) instead of a fresh checkout.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getStripe, priceId, TRIAL_DAYS, type PlanId, type Interval } from "@/lib/stripe";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "edge";

const APP_URL = process.env.BETTER_AUTH_URL || "https://lullawood.com";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { plan, interval } = (await req.json().catch(() => ({}))) as {
    plan?: PlanId;
    interval?: Interval;
  };
  if (!plan || !interval) {
    return NextResponse.json({ error: "Missing plan or interval" }, { status: 400 });
  }

  let price: string;
  try {
    price = priceId(plan, interval);
  } catch {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const stripe = getStripe();
  const db = getDb();

  // Reuse an existing Stripe customer for this parent if we have one.
  let customerId: string | undefined;
  try {
    const [existing] = await db
      .select({ c: schema.subscriptions.stripeCustomerId })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, user.id))
      .limit(1);
    customerId = existing?.c ?? undefined;
  } catch { /* no row yet — fine */ }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { userId: user.id, plan },
    },
    // Belt-and-braces: also tag the session so the webhook can recover the user.
    metadata: { userId: user.id, plan },
    success_url: `${APP_URL}/dashboard?welcome=1`,
    cancel_url: `${APP_URL}/#pricing`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}