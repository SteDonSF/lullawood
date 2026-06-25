import { STEPS } from "@/lib/content";
import { SectionHead } from "./Section";

export function HowItWorks() {
  return (
    <section id="how" className="bg-parchment-deep py-[74px]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="How it works" heading="Set it up once. Then every night takes care of itself." />
        {/* One continuous panoramic (prompt 20): profile → story arrives → bedtime reading */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-border shadow-page">
          <img src="/art/how-pano.webp" alt="Create a profile, a story arrives each night, and you read it at bedtime"
            className="w-full object-cover" />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center md:text-left">
              <p className="h-display text-lg italic text-gold-text">Step {s.n}</p>
              <h3 className="h-display mt-1 text-xl font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[15px] text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
