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
// ALREADY SUBSCRIBED: refused with 409 { error: "already_subscribed" }. A
//   second `mode: "subscription"` checkout would create a SECOND subscription
//   (new trial, card re-collected) on the same customer, and the webhook's
//   upsert is keyed to userId — one row per parent — so the two would fight
//   over it. Plan changes go through /api/subscription/upgrade instead, which
//   swaps the price on the existing subscription in place.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getStripe, priceId, TRIAL_DAYS, type PlanId, type Interval } from "@/lib/stripe";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "edge";

const APP_URL = process.env.BETTER_AUTH_URL || "https://lullawood.com";

// A subscription in one of these states is live: starting another one would
// double-bill the parent. (Mirrors ACTIVE_STATUSES in src/lib/subscription.ts —
// canceled/past_due parents are free to check out again.)
const LIVE_STATUSES = new Set(["trialing", "active"]);

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

  // Reuse an existing Stripe customer for this parent if we have one — and
  // refuse outright if they already have a live subscription.
  let customerId: string | undefined;
  let currentPlan: string | null = null;
  let currentStatus: string | null = null;
  try {
    const [existing] = await db
      .select({
        c: schema.subscriptions.stripeCustomerId,
        plan: schema.subscriptions.plan,
        status: schema.subscriptions.status,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, user.id))
      .limit(1);
    customerId = existing?.c ?? undefined;
    currentPlan = existing?.plan ?? null;
    currentStatus = existing?.status ?? null;
  } catch { /* no row yet — fine */ }

  // A parent on a live plan must never start a second one. `upgradeable` tells
  // /pricing whether to offer the in-place switch or the billing portal.
  if (currentStatus && LIVE_STATUSES.has(currentStatus)) {
    const upgradeable = currentPlan === "dreamer" && plan === "family";
    return NextResponse.json(
      {
        error: "already_subscribed",
        plan: currentPlan,
        requestedPlan: plan,
        upgradeable,
        message: upgradeable
          ? "You're on the Dreamer plan — switch to Family instead of starting a new one."
          : "You already have an active plan.",
      },
      { status: 409 }
    );
  }

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
    cancel_url: `${APP_URL}/pricing`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}