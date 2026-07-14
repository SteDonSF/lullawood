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
import Link from "next/link";
import { Demo } from "@/components/Demo";
import { Mark } from "@/components/Mark";
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
      <header className="relative z-20 pt-6">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <Mark size={30} pine="#2A3422" ring="#D28E28" accent="#D28E28" />
            <span className="wordmark text-[22px] font-semibold">Lullawood</span>
          </Link>
          <nav className="ml-auto hidden gap-7 text-[15px] font-semibold text-ink-muted hover:text-ink md:flex">
            <Link href="/how-it-works" className="hover:text-ink">How it works</Link>
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/login" className="hover:text-ink">Log in</Link>
          </nav>
        </div>
      </header>

      <section className="pt-10">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHead heading={DEMO.heading} sub={DEMO.sub} />
          <div className="mt-10"><Demo /></div>
        </div>
      </section>
    </main>
  );
}
