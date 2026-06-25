import { REASONS } from "@/lib/content";
import { SectionHead } from "./Section";
import { Illustration } from "./Illustration";

export function WhyLullawood() {
  return (
    <section id="different" className="py-[74px]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Why Lullawood" heading="Not a story with a name dropped in. A world built around them." />
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((r) => (
            <div key={r.title} className="overflow-hidden rounded-2xl border border-border bg-cream-paper shadow-page transition hover:-translate-y-1 hover:border-gold">
              <Illustration slot={r.art} alt={r.title} width={1536} height={1024} placeholder={false} rounded="rounded-none" className="aspect-[3/2] w-full" />
              <div className="p-6">
                <h3 className="h-display text-xl font-semibold text-gold-text">{r.title}</h3>
                <p className="mt-2 text-[14.5px] text-ink-muted">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
