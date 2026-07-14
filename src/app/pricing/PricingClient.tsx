"use client";
// =============================================================================
// PricingClient  —  Plan picker -> Stripe checkout (Phase 5)
// Rendered by ./page.tsx (a server component that owns the route's metadata,
// including the canonical link). Keep all interactive logic here.
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
import { TIERS, BADGE, TRUST_STRIP } from "@/lib/content";
import { Mark } from "@/components/Mark";

type Interval = "monthly" | "yearly";

export default function PricingClient() {
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
        <header className="mb-8 flex items-center gap-4">
          <a href="/" className="flex items-center gap-2.5">
            <Mark size={30} ring="#D28E28" pine="#2A3422" accent="#D28E28" />
            <span className="wordmark text-[20px] font-semibold text-ink">Lullawood</span>
            <span className="ml-1 hidden eyebrow-caps text-[11px] text-gold-text sm:inline">A new story every night</span>
          </a>
          {/* Returning parents who land straight on /pricing need a reachable log-in. */}
          <a href="/login" className="ml-auto whitespace-nowrap text-[15px] font-semibold text-ink-muted hover:text-ink">Log in</a>
        </header>
        <div className="mb-8 text-center">
          <h1 className="h-display mb-2 text-3xl font-semibold text-ink">Choose your plan</h1>
          <p className="text-[15px] text-ink-muted">
            Start with a 7-day free trial. Cancel anytime before it ends and you won&apos;t be charged.
          </p>
        </div>

        {/* monthly / annual toggle */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-parchment-deep/60 p-1 shadow-[inset_0_1px_3px_rgba(120,90,30,.12)]">
            <button
              onClick={() => setInterval("monthly")}
              className={`rounded-full px-5 py-2 text-[14px] font-bold transition ${
                interval === "monthly" ? "bg-cream-paper text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("yearly")}
              className={`rounded-full px-5 py-2 text-[14px] font-bold transition ${
                interval === "yearly" ? "bg-cream-paper text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              Annual <span className="font-normal text-gold-text">· 2 months free</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-6 text-center text-[14px] font-semibold text-[#c2553d]">{error}</p>
        )}

        <div className="grid items-stretch gap-5 sm:grid-cols-2">
          {TIERS.map((p) => (
            <div
              key={p.id}
              className={`flex flex-col rounded-3xl warm-card p-7 ${
                p.highlighted ? "border-gold ring-2 ring-gold/30" : "border-border"
              }`}
            >
              <div className="mb-3 h-[26px]">
                {p.highlighted && (
                  <span className="inline-block rounded-full bg-gold/15 px-3 py-1 text-[12px] font-bold text-[#8a6a12]">
                    {BADGE}
                  </span>
                )}
              </div>
              <h2 className="h-display text-2xl font-semibold text-ink">{p.name}</h2>
              <p className="mb-4 text-[14px] text-ink-muted">{p.blurb}</p>

              <div className="mb-5 flex items-baseline gap-1">
                <span className="text-[40px] font-bold leading-none text-ink">
                  {interval === "monthly" ? p.monthly : p.yearly}
                </span>
                <span className="text-[15px] font-semibold text-ink-muted">
                  {interval === "monthly" ? "/mo" : "/yr"}
                </span>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {p.features.map((f, i) => (
                  <li key={i} className="flex min-h-[2.75rem] items-start gap-2 text-[14px] text-ink">
                    <span className="mt-0.5 text-gold">✦</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => startCheckout(p.id as "dreamer" | "family")}
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

        <ul className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-semibold text-ink-muted">
          {TRUST_STRIP.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="text-gold-text">✓</span>{s}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-[13px] text-ink-muted">
          7-day free trial, then your plan renews automatically. Cancel anytime.
        </p>
      </div>
    </main>
  );
}