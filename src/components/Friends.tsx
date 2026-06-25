import { CHARACTERS } from "@/lib/content";
import { SectionHead } from "./Section";

export function Friends() {
  return (
    <section id="friends" className="bg-parchment-deep py-[74px]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Meet the friends" heading="The companions who remember your child." sub="They recur across stories — greeting, guiding, and growing alongside your little one." />
        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {CHARACTERS.map((c) => (
            <div key={c.name} className="text-center">
              <div className="mx-auto aspect-square w-full overflow-hidden rounded-full ring-1 ring-border/60 bg-cream-paper shadow-page">
                <img src={`/art/${c.art}.webp`} alt={c.name} className="h-full w-full object-cover" />
              </div>
              <h3 className="h-display mt-4 text-lg font-semibold text-ink">{c.name}</h3>
              <p className="mt-1 text-[13px] leading-snug text-ink-muted">{c.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
