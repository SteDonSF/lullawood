export function SectionHead({ eyebrow, heading, sub }: { eyebrow: string; heading: string; sub?: string }) {
  return (
    <div className="text-center">
      <p className="inline-block text-xs font-extrabold uppercase tracking-[0.14em] text-peach">{eyebrow}</p>
      <h2 className="h-display mx-auto mt-3 max-w-[760px] text-[clamp(26px,3.4vw,38px)] font-semibold leading-[1.15] text-ink">{heading}</h2>
      {sub && <p className="mx-auto mt-3.5 max-w-[540px] text-[16px] text-ink-muted">{sub}</p>}
      <div className="rule-gold mx-auto mt-6 max-w-[120px]" />
    </div>
  );
}
