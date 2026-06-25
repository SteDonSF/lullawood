import Link from "next/link";
import { Mark } from "./Mark";

export function Nav({ overDark = false }: { overDark?: boolean }) {
  const link = overDark ? "text-cream/85 hover:text-cream" : "text-ink-muted hover:text-ink";
  return (
    <header className="relative z-20 pt-6">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6">
        <Link href="/" className={`flex items-center gap-2.5 ${overDark ? "text-cream-paper" : "text-ink"}`}>
          <Mark size={30} pine={overDark ? "#EDE7D6" : "#2A3422"} ring="#D28E28" accent="#D28E28" />
          <span className="wordmark text-[22px] font-semibold">Lullawood</span>
        </Link>
        <nav className={`ml-auto hidden gap-7 text-[15px] font-semibold md:flex ${link}`}>
          <a href="#try">Try a story</a>
          <a href="#how">How it works</a>
          <a href="#world">The world</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">Our story</a>
        </nav>
        <a href="#try"
          className={overDark
            ? "rounded-full border border-cream/40 bg-white/10 px-5 py-2.5 text-[15px] font-bold text-cream hover:bg-white/20"
            : "rounded-full border border-border bg-white px-5 py-2.5 text-[15px] font-bold text-ink hover:bg-cream-paper"}>
          Try free
        </a>
      </div>
    </header>
  );
}
