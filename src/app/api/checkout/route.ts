import { NextRequest, NextResponse } from "next/server";
// import { getStripe, PRICE_IDS } from "@/lib/stripe";

export const runtime = "edge";

// Creates a Stripe Checkout session for the chosen plan (7-day trial).
// Typed stub — uncomment once STRIPE_SECRET_KEY + price IDs are set.
export async function POST(req: NextRequest) {
  const { plan } = await req.json();
  // const stripe = getStripe();
  // const session = await stripe.checkout.sessions.create({
  //   mode: "subscription",
  //   line_items: [{ price: PRICE_IDS[plan]!, quantity: 1 }],
  //   subscription_data: { trial_period_days: 7 },
  //   success_url: `${process.env.APP_URL}/welcome`,
  //   cancel_url: `${process.env.APP_URL}/#pricing`,
  // });
  // return NextResponse.json({ url: session.url });
  return NextResponse.json({ ok: true, plan, note: "stub — wire Stripe to return a checkout url" });
}
