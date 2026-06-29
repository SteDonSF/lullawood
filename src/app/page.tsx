import { Hero } from "@/components/Hero";
import { Demo } from "@/components/Demo";
import { WhyLullawood } from "@/components/WhyLullawood";
import { HowItWorks } from "@/components/HowItWorks";
import { WorldGallery } from "@/components/WorldGallery";
import { Friends } from "@/components/Friends";
import { Testimonials } from "@/components/Testimonials";
import { Pricing } from "@/components/Pricing";
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
      <About />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
