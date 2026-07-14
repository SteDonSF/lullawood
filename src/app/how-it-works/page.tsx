// =============================================================================
// /how-it-works  —  Standalone, indexable explainer for the nightly ritual.
// -----------------------------------------------------------------------------
// The homepage keeps a short teaser that links here (href="/how-it-works").
// This page is written to stand on its own — own title + meta description, a
// proper lead-in, and a closing CTA — not a copy-paste of the homepage section.
// Steps copy is shared from content.ts (STEPS) so the two never drift.
// =============================================================================
import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/Mark";
import { STEPS } from "@/lib/content";

export const metadata: Metadata = {
  title: "How Lullawood works — a new bedtime story for your child, every night",
  description:
    "Set up your child's profile once — their name, the animals and worlds they love, a bedtime. Then every night a fresh, personalized story is ready and waiting, written to be read aloud and wind them gently down to sleep.",
  alternates: { canonical: "https://lullawood.com/how-it-works" },
  openGraph: {
    title: "How Lullawood works",
    description:
      "Set it up once. Then every night, a fresh personalized bedtime story is ready and waiting — written to be read aloud and wind your child down to sleep.",
    type: "website",
  },
};

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-cream-paper">
      <header className="relative z-20 pt-6">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <Mark size={30} pine="#2A3422" ring="#D28E28" accent="#D28E28" />
            <span className="wordmark text-[22px] font-semibold">Lullawood</span>
          </Link>
          <nav className="ml-auto hidden gap-7 text-[15px] font-semibold text-ink-muted hover:text-ink md:flex">
            <Link href="/try" className="hover:text-ink">Try free</Link>
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/login" className="hover:text-ink">Log in</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-[64px]">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="inline-block text-xs font-extrabold uppercase tracking-[0.14em] text-peach">How it works</p>
          <h1 className="h-display mx-auto mt-3 text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.12] text-ink">
            Set it up once. Then every night takes care of itself.
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-relaxed text-ink-muted">
            Lullawood turns bedtime into a ritual you look forward to. You tell us about your child
            one time — then each night you open Lullawood and a fresh story is written for them on
            the spot, made to be read aloud and to bring the day gently down to sleep.
          </p>
          <div className="rule-gold mx-auto mt-6 max-w-[120px]" />
        </div>

        {/* One continuous panoramic: profile → story arrives → bedtime reading */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-border shadow-page">
          <img
            src="/art/how-pano.webp"
            alt="Create a profile, write a fresh story each night, and read it aloud at bedtime"
            className="w-full object-cover"
          />
        </div>

        <ol className="mt-12 grid list-none grid-cols-1 gap-8 p-0 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n}>
              <p className="h-display text-lg italic text-gold-text">Step {s.n}</p>
              <h2 className="h-display mt-1 text-xl font-semibold text-ink">{s.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 flex flex-col items-center gap-4 text-center">
          <p className="h-display text-[22px] font-semibold text-ink">See it for yourself first.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/try"
              className="rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-8 py-3.5 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5"
            >
              Try free →
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-border bg-white px-8 py-3.5 text-[15px] font-bold text-ink transition hover:bg-cream-paper"
            >
              See plans
            </Link>
          </div>
          <p className="mt-1 text-[12.5px] font-semibold text-ink-muted/80">
            Every story safety-reviewed · No ads, ever · Cancel anytime
          </p>
        </div>
      </section>
    </main>
  );
}
