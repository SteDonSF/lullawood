import { TIERS } from "@/lib/content";
import { SectionHead } from "./Section";

export function Pricing() {
  return (
    <section id="pricing" className="bg-parchment-deep py-[74px]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Pricing" heading="Less than a single picture book a month." sub="Launching soon. Join the waitlist and founding families get first access — and a founding price." />
        <div className="mt-12 grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.id}
              className={`relative flex flex-col rounded-[22px] border bg-cream-paper p-8 shadow-page ${
                t.featured ? "border-gold bg-[#fffdf4] shadow-lift" : "border-border"}`}>
              {t.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-3.5 py-1 text-[11.5px] font-extrabold uppercase tracking-wider text-[#3a2d05]">
                  Most loved
                </span>
              )}
              <h3 className="h-display text-2xl font-semibold text-ink">{t.name}</h3>
              <p className="mb-4 mt-1 text-[14.5px] text-ink-muted">{t.blurb}</p>
              <div className="flex items-start gap-0.5">
                <span className="mt-2 text-2xl text-ink-muted">$</span>
                <span className="h-display text-[50px] font-semibold leading-none text-ink">{t.price}</span>
                <span className="mb-2 self-end text-[16px] font-bold text-ink-muted">{t.cadence}</span>
              </div>
              <span className="mt-1 text-[13.5px] text-ink-muted/80">{t.year}</span>
              <ul className="my-5 flex flex-1 list-none flex-col gap-2.5 p-0">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[15px] text-ink">
                    <span className="text-[13px] text-gold-text">✦</span>{f}
                  </li>
                ))}
              </ul>
              <a href="#waitlist"
                className={`w-full rounded-full px-5 py-3 text-center text-[15px] font-bold transition hover:-translate-y-0.5 ${
                  t.featured ? "bg-gradient-to-b from-gold to-[#e3ac3c] text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)]" : "border border-border bg-white text-ink hover:bg-cream-paper"}`}>
                Join the waitlist
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
