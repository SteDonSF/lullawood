import { ABOUT } from "@/lib/content";

export function About() {
  return (
    <section id="about" className="py-[74px]">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-2">
        <figure className="m-0">
          <div className="overflow-hidden rounded-2xl border border-border bg-cream-paper shadow-lift">
            <img src="/art/founder.webp" alt="Stephen, founder of Lullawood, with his two sons" className="w-full object-cover" />
          </div>
          <figcaption className="mt-3 text-center text-[13px] text-ink-muted">{ABOUT.caption}</figcaption>
        </figure>
        <div>
          <p className="eyebrow-caps text-[12px] text-peach">{ABOUT.eyebrow}</p>
          <h2 className="h-display mt-3 text-[clamp(26px,3.4vw,36px)] font-semibold leading-tight text-ink">{ABOUT.heading}</h2>
          <div className="mt-5 space-y-4 text-[16px] text-ink-soft">
            {ABOUT.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="h-display mt-5 text-[17px] italic text-gold-text">{ABOUT.signature}</p>
        </div>
      </div>
    </section>
  );
}
