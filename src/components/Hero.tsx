import { Nav } from "./Nav";
import { HERO } from "@/lib/content";

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-[86vh] flex-col overflow-hidden">
      {/* Hero illustration (prompt 13) — left side kept clear for headline */}
      <div className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/art/hero.webp')" }} />
      <div className="absolute inset-0 z-[1]"
        style={{ background: "linear-gradient(90deg, rgba(12,14,20,.82) 0%, rgba(12,14,20,.5) 38%, rgba(12,14,20,.06) 66%, rgba(12,14,20,0) 100%), linear-gradient(0deg, rgba(12,14,20,.55), rgba(12,14,20,0) 42%)" }} />

      <Nav overDark />

      <div className="relative z-[3] mx-auto mt-auto w-full max-w-6xl px-6 pb-[10vh]">
        <div className="max-w-[640px]">
          <p className="eyebrow-caps text-[12px] text-gold">A new story every night</p>
          <h1 className="h-display mt-4 text-[clamp(40px,6vw,66px)] font-bold leading-[1.03] text-cream-paper" style={{ textShadow: "0 2px 24px rgba(0,0,0,.5)" }}>
            {HERO.headline}
          </h1>
          <p className="mt-5 max-w-[540px] text-[clamp(16px,2vw,19px)] text-cream-paper/90" style={{ textShadow: "0 1px 12px rgba(0,0,0,.5)" }}>
            {HERO.sub} {HERO.body}
          </p>
          <a href="#try"
            className="mt-8 inline-block rounded-full bg-gradient-to-b from-gold to-[#c47e1e] px-8 py-4 text-[16px] font-bold text-[#2a2007] shadow-[0_12px_32px_rgba(210,142,40,.5)] transition hover:-translate-y-0.5">
            {HERO.cta} →
          </a>
        </div>
      </div>
    </section>
  );
}
