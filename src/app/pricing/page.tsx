// =============================================================================
// /pricing  —  server component: owns the route's metadata (incl. canonical),
// then renders the interactive PricingClient (plan picker -> Stripe checkout).
// The homepage no longer re-renders the pricing cards; it links here instead,
// so this is the single canonical pricing surface.
// =============================================================================
import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const runtime = "edge";

export const metadata: Metadata = {
  title: "Pricing — Lullawood",
  description:
    "Less than a single picture book a month. Every Lullawood plan starts with a 7-day free trial — a new personalized bedtime story every night. Cancel anytime.",
  alternates: { canonical: "https://lullawood.com/pricing" },
  openGraph: {
    title: "Pricing — Lullawood",
    description:
      "A new personalized bedtime story every night, for less than a single picture book a month. 7-day free trial, cancel anytime.",
    type: "website",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
