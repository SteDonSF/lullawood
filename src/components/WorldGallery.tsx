import { WORLD } from "@/lib/content";
import { SectionHead } from "./Section";

export function WorldGallery() {
  return (
    <section id="world" className="py-[74px]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="The world of Lullawood" heading="Six places your child will return to, night after night." sub="Stories move through real, recurring places — so the world grows familiar and beloved." />
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {WORLD.map((p) => (
            <figure key={p.name} className="group overflow-hidden rounded-2xl border border-border bg-cream-paper shadow-page">
              <div className="relative aspect-[3/2] overflow-hidden">
                <img src={`/art/${p.art}.webp`} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <span className="h-display text-lg font-semibold text-cream-paper">{p.name}</span>
                </figcaption>
              </div>
              <p className="p-5 text-[14.5px] text-ink-muted">{p.blurb}</p>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
