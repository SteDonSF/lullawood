import { TESTIMONIALS } from "@/lib/content";
import { SectionHead } from "./Section";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-gold" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}<span className="text-gold/30">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function Testimonials() {
  return (
    <section id="loved" className="py-[74px]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Loved by families" heading="The parents who tried it first." sub="Early reactions from families who tested Lullawood stories at home." />
        {/* Illustrated backdrop (prompt 21) */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-border shadow-page">
          <img src="/art/testimonials.webp" alt="A parent closing a finished storybook beside a peacefully sleeping child" className="w-full object-cover" />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <figure key={i} className="rounded-2xl border border-border bg-cream-paper p-6 shadow-page">
              <Stars n={t.stars} />
              <blockquote className="mt-3 text-[15.5px] leading-relaxed text-ink">{t.quote}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gold/20 text-[14px] font-bold text-gold-text ring-1 ring-gold/40">{t.initials}</span>
                <span className="text-[14px] font-bold text-ink">{t.name}<span className="block font-normal text-ink-muted">{t.detail}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-8 text-center text-[12.5px] text-ink-muted/70">Early-tester feedback from sample stories, shared with permission.</p>
      </div>
    </section>
  );
}
