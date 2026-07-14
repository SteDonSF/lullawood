import Link from "next/link";
import { Hero } from "@/components/Hero";
import { WhyLullawood } from "@/components/WhyLullawood";
import { WorldGallery } from "@/components/WorldGallery";
import { Friends } from "@/components/Friends";
import { Testimonials } from "@/components/Testimonials";
import { About } from "@/components/About";
import { FAQ } from "@/components/FAQ";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { SectionHead } from "@/components/Section";
import { DEMO, STEPS, TIERS } from "@/lib/content";

export default function Home() {
  return (
    <main>
      <Hero />

      {/* Try teaser — the full demo now lives at /try (shareable + indexable).
          id kept so any external /#try fragment still lands here. */}
      <section id="try" className="pt-8 pb-[74px]">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <SectionHead heading={DEMO.heading} sub={DEMO.sub} />
          <Link href="/try"
            className="mt-8 inline-block rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-8 py-4 text-[16px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5">
            Try free →
          </Link>
          <p className="mt-4 text-[12.5px] font-semibold text-ink-muted/80">
            No account, no email · A free glimpse of what you'll create every night
          </p>
        </div>
      </section>

      <WhyLullawood />

      {/* How-it-works teaser — full explainer now lives at /how-it-works.
          id kept so any external /#how fragment still lands here. */}
      <section id="how" className="bg-parchment-deep py-[74px]">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHead eyebrow="How it works" heading="Set it up once. Then every night takes care of itself." />
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center md:text-left">
                <p className="h-display text-lg italic text-gold-text">Step {s.n}</p>
                <h3 className="h-display mt-1 text-xl font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] text-ink-muted">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/how-it-works"
              className="inline-block rounded-full border border-border bg-white px-7 py-3 text-[15px] font-bold text-ink transition hover:-translate-y-0.5 hover:bg-cream-paper">
              See how it works →
            </Link>
          </div>
        </div>
      </section>

      <WorldGallery />
      <Friends />
      <Testimonials />

      {/* Pricing teaser — the canonical pricing page is /pricing. Don't
          re-render the tier cards here; link to the real page instead.
          id kept so any external /#pricing fragment still lands here. */}
      <section id="pricing" className="bg-parchment-deep py-[74px]">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <SectionHead
            eyebrow="Pricing"
            heading="Less than a single picture book a month."
            sub="Every plan starts with a 7-day free trial. Cancel anytime before it ends and you won't be charged."
          />
          {/* Teaser price hint (sourced from TIERS so it can't drift from /pricing) */}
          <p className="mt-6 text-[16px] font-semibold text-ink">
            {TIERS.map((t) => `${t.name} ${t.monthly}/mo`).join("  ·  ")}
          </p>
          <Link href="/pricing"
            className="mt-8 inline-block rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-8 py-4 text-[16px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5">
            See plans →
          </Link>
          <p className="mt-4 text-[12.5px] font-semibold text-ink-muted/80">
            Safe by design · No ads, ever · Cancel anytime
          </p>
        </div>
      </section>

      <About />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
