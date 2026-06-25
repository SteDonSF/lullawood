import { Hero } from "@/components/Hero";
import { Demo } from "@/components/Demo";
import { WhyLullawood } from "@/components/WhyLullawood";
import { HowItWorks } from "@/components/HowItWorks";
import { WorldGallery } from "@/components/WorldGallery";
import { Friends } from "@/components/Friends";
import { Testimonials } from "@/components/Testimonials";
import { Pricing } from "@/components/Pricing";
import { Waitlist } from "@/components/Waitlist";
import { About } from "@/components/About";
import { FAQ } from "@/components/FAQ";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { SectionHead } from "@/components/Section";
import { DEMO } from "@/lib/content";

export default function Home() {
  return (
    <main>
      <Hero />

      <section id="try" className="py-[74px]">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHead eyebrow={DEMO.eyebrow} heading={DEMO.heading} sub={DEMO.sub} />
          <div className="mt-10"><Demo /></div>
        </div>
      </section>

      <WhyLullawood />
      <HowItWorks />
      <WorldGallery />
      <Friends />
      <Testimonials />
      <Pricing />

      <section id="waitlist" className="bg-parchment-deep py-[74px]">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <SectionHead eyebrow="Founding families" heading="Lullawood is opening its gates soon." sub="Join the waitlist to be among the first families inside — with a founding price when we launch." />
          <div className="mt-8"><Waitlist source="home" /></div>
        </div>
      </section>

      <About />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
