// =============================================================================
// /try  —  The free demo, as a standalone, shareable/indexable page.
// -----------------------------------------------------------------------------
// WHAT: Lifts the homepage demo onto its own route so it can be linked and
//   indexed on its own. The <Demo /> component is unchanged — rate limiting,
//   session, and generation all live server-side in /api/generate-story, so
//   rendering it here behaves identically to rendering it on the homepage.
// The homepage keeps a short teaser that links here (href="/try").
// =============================================================================
import type { Metadata } from "next";
import { Demo } from "@/components/Demo";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SectionHead } from "@/components/Section";
import { DEMO } from "@/lib/content";

export const metadata: Metadata = {
  title: "Try Lullawood free — write your child's bedtime story now",
  description:
    "Type your child's name and watch a personalized bedtime story appear in seconds. No account, no email — a free glimpse of the story Lullawood writes for your child every night.",
  alternates: { canonical: "https://lullawood.com/try" },
  openGraph: {
    title: "Try Lullawood free — write your child's bedtime story now",
    description:
      "Type your child's name and watch a personalized bedtime story appear in seconds. No account, no email needed.",
    type: "website",
  },
};

export default function TryPage() {
  return (
    <main className="min-h-screen bg-cream-paper pb-[74px]">
      <Nav />

      <section className="pt-10">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHead heading={DEMO.heading} sub={DEMO.sub} />
          {/* Mobile: safety line above the demo/CTA — trust strip is below the fold (audit P1-2). */}
          <p className="mt-4 text-center text-[12.5px] text-ink-muted md:hidden">Safe by design · No ads · Cancel anytime</p>
          <div className="mt-10"><Demo /></div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
