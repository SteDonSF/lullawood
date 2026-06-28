"use client";
export const runtime = "edge";
// =============================================================================
// /pricing  —  Plan picker -> Stripe checkout (Phase 5)
// -----------------------------------------------------------------------------
// WHAT: A logged-in parent chooses Dreamer or Family, monthly or annual, and
//   starts a 7-day free trial. The button POSTs { plan, interval } to
//   /api/checkout, which returns a Stripe-hosted URL we redirect to.
// PRICES (display only — Stripe is the source of truth for what's charged):
//   Dreamer  $8.99/mo  ·  $89.99/yr   (2 months free)
//   Family   $12.99/mo ·  $129.99/yr  (2 months free)
// NOTE: not logged in -> the checkout API returns 401; we send them to /login.
//
// LULLAWOOD-FUTURE: founding-family pricing -> a promo banner + promo code at
//   checkout (allow_promotion_codes is already enabled in the checkout route).
// LULLAWOOD-FUTURE: Keepsake tier slots in as a third card when it ships.
// LULLAWOOD-FUTURE: once gating exists, the dashboard redirects here when a
//   parent without an active subscription tries to generate a story.
// =============================================================================
import { useState } from "react";

type Interval = "monthly" | "yearly";

const PLANS = [
  {
    id: "dreamer" as const,
    name: "Dreamer",
    blurb: "One child, a fresh story every night.",
    monthly: "$8.99",
    yearly: "$89.99",
    features: [
      "One child profile",
      "A new personalized story every night",
      "Remembers past adventures",
      "Tuned to your child's exact age",
    ],
  },
  {
    id: "family" as const,
    name: "Family",
    blurb: "The whole household, together in Lullawood.",
    monthly: "$12.99",
    yearly: "$129.99",
    highlighted: true,
    features: [
      "Up to four children",
      "Multiple caregivers",
      "Sibling co-star adventures",
      "Everything in Dreamer",
    ],
  },
];

export default function PricingPage() {
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loading, setLoading] = useState<string>("");
  const [error, setError] = useState("");

  async function startCheckout(plan: "dreamer" | "family") {
    setError("");
    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      if (res.status === 401) {
        window.location.href = "/login?next=/pricing";
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) {
        setError(d.error || "Couldn't start checkout. Please try again.");
        setLoading("");
        return;
      }
      window.location.href = d.url; // -> Stripe hosted checkout
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setLoading("");
    }
  }

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="h-display mb-2 text-3xl font-semibold text-ink">Choose your plan</h1>
          <p className="text-[15px] text-ink-muted">
            Start with a 7-day free trial. Cancel anytime before it ends and you won&apos;t be charged.
          </p>
        </div>

        {/* monthly / annual toggle */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-4 py-2 text-[14px] font-bold transition ${
              interval === "monthly" ? "bg-ink text-cream-paper" : "text-ink-muted hover:text-ink"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("yearly")}
            className={`rounded-full px-4 py-2 text-[14px] font-bold transition ${
              interval === "yearly" ? "bg-ink text-cream-paper" : "text-ink-muted hover:text-ink"
            }`}
          >
            Annual <span className="font-normal">— 2 months free</span>
          </button>
        </div>

        {error && (
          <p className="mb-6 text-center text-[14px] font-semibold text-[#c2553d]">{error}</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`rounded-3xl border bg-white p-7 shadow-lift ${
                p.highlighted ? "border-gold ring-2 ring-gold/30" : "border-border"
              }`}
            >
              {p.highlighted && (
                <span className="mb-3 inline-block rounded-full bg-gold/15 px-3 py-1 text-[12px] font-bold text-[#8a6a12]">
                  Most popular
                </span>
              )}
              <h2 className="h-display text-2xl font-semibold text-ink">{p.name}</h2>
              <p className="mb-4 text-[14px] text-ink-muted">{p.blurb}</p>

              <div className="mb-5">
                <span className="text-3xl font-bold text-ink">
                  {interval === "monthly" ? p.monthly : p.yearly}
                </span>
                <span className="text-[14px] text-ink-muted">
                  {interval === "monthly" ? " / month" : " / year"}
                </span>
              </div>

              <ul className="mb-6 space-y-2">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-ink">
                    <span className="mt-0.5 text-gold">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => startCheckout(p.id)}
                disabled={loading === p.id}
                className={`w-full rounded-full px-6 py-3 text-[15px] font-bold transition hover:-translate-y-0.5 disabled:opacity-70 ${
                  p.highlighted
                    ? "bg-gradient-to-b from-gold to-[#e3ac3c] text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)]"
                    : "border border-border bg-white text-ink"
                }`}
              >
                {loading === p.id ? "Starting…" : "Start free trial"}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[13px] text-ink-muted">
          7-day free trial, then your plan renews automatically. Cancel anytime.
        </p>
      </div>
    </main>
  );
}