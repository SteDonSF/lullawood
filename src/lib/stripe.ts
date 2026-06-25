import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

// Map each plan to a Stripe Price ID (set in your dashboard, then in .env).
export const PRICE_IDS: Record<string, string | undefined> = {
  dreamer: process.env.STRIPE_PRICE_DREAMER,
  family: process.env.STRIPE_PRICE_FAMILY,
  keepsake: process.env.STRIPE_PRICE_KEEPSAKE,
};
