"use client";
import { useState } from "react";
import { FAQS } from "@/lib/content";
import { SectionHead } from "./Section";

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-parchment-deep py-[74px]">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHead eyebrow="Honest answers" heading="The questions parents actually ask." />
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-cream-paper">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                <span className="h-display text-[18px] font-semibold text-ink">{f.q}</span>
                <span className="text-xl text-gold-text">{open === i ? "–" : "+"}</span>
              </button>
              {open === i && <p className="px-6 pb-6 text-[15.5px] leading-relaxed text-ink-muted">{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
