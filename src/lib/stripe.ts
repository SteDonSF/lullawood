// =============================================================================
// src/lib/stripe.ts  —  Stripe client + plan/price mapping
// -----------------------------------------------------------------------------
// WHAT: One place to construct the Stripe client (per-request, mirroring
//   getDb()/getAuth()) and to map our plan names <-> Stripe price IDs.
// USED BY: /api/checkout, /api/stripe/webhook, the pricing page.
// Price IDs live in env vars (test now, live later) so prices change without
// a code edit. Set in .env.local locally and in Cloudflare for production.
// LULLAWOOD-FUTURE: add the Keepsake tier's product + prices when it ships.
// =============================================================================
import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export type PlanId = "dreamer" | "family";
export type Interval = "monthly" | "yearly";

// Resolve a plan+interval to its Stripe price ID (from env).
export function priceId(plan: PlanId, interval: Interval): string {
  const map: Record<string, string | undefined> = {
    "dreamer:monthly": process.env.STRIPE_PRICE_DREAMER_MONTHLY,
    "dreamer:yearly": process.env.STRIPE_PRICE_DREAMER_YEARLY,
    "family:monthly": process.env.STRIPE_PRICE_FAMILY_MONTHLY,
    "family:yearly": process.env.STRIPE_PRICE_FAMILY_YEARLY,
  };
  const id = map[`${plan}:${interval}`];
  if (!id) throw new Error(`No price configured for ${plan}:${interval}`);
  return id;
}

// Reverse lookup for the webhook: given a Stripe price ID, which plan is it?
export function planFromPriceId(id: string): PlanId | null {
  if (id === process.env.STRIPE_PRICE_DREAMER_MONTHLY) return "dreamer";
  if (id === process.env.STRIPE_PRICE_DREAMER_YEARLY) return "dreamer";
  if (id === process.env.STRIPE_PRICE_FAMILY_MONTHLY) return "family";
  if (id === process.env.STRIPE_PRICE_FAMILY_YEARLY) return "family";
  return null;
}

// Per-plan child cap. Enforced in the add-a-child flow + story gating.
export const PLAN_LIMITS: Record<PlanId, { maxChildren: number }> = {
  dreamer: { maxChildren: 1 },
  family: { maxChildren: 4 },
};

// Trial length in days (Stripe applies this on the subscription).
export const TRIAL_DAYS = 7;