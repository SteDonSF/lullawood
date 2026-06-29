import { FINAL } from "@/lib/content";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative flex min-h-[68vh] items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: "url('/art/closing.webp')" }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(10,12,18,.7), rgba(10,12,18,.25) 55%, rgba(10,12,18,.45))" }} />
        <div className="relative z-[2] mx-auto max-w-[780px] px-6 text-center">
          <h2 className="h-display text-[clamp(28px,4vw,48px)] font-semibold leading-tight text-cream-paper" style={{ textShadow: "0 2px 24px rgba(0,0,0,.55)" }}>
            {FINAL.headline}
          </h2>
          <a href="/signup"
            className="mt-8 inline-block rounded-full bg-gradient-to-b from-gold to-[#c47e1e] px-8 py-4 text-[16px] font-bold text-[#2a2007] shadow-[0_12px_32px_rgba(210,142,40,.5)] transition hover:-translate-y-0.5">
            {FINAL.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
