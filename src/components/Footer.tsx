import Link from "next/link";
import { Mark } from "./Mark";

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 text-ink"><Mark size={26} /><span className="wordmark text-lg font-semibold">Lullawood</span></div>
          <p className="h-display mt-1 text-[15px] italic text-gold-text">Stories for little dreamers</p>
          <p className="mt-3 max-w-xs text-[14px] text-ink-muted">A bedtime world, made for one child at a time. A new story every night, yours to read aloud.</p>
        </div>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Lullawood</p>
          <ul className="mt-3 space-y-2 text-[14px] text-ink-muted">
            <li><a href="#how" className="hover:text-ink">How it works</a></li>
            <li><a href="#pricing" className="hover:text-ink">Pricing</a></li>
            <li><a href="#about" className="hover:text-ink">Our story</a></li>
            <li><a href="#faq" className="hover:text-ink">FAQ</a></li>
          </ul>
        </div>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Trust &amp; legal</p>
          <ul className="mt-3 space-y-2 text-[14px] text-ink-muted">
            <li><Link href="/privacy" className="hover:text-ink">Privacy policy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
            <li><Link href="/safety" className="hover:text-ink">Child safety</Link></li>
            <li><a href="mailto:hello@lullawood.com" className="hover:text-ink">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-6xl px-6 text-[12.5px] text-ink-muted/70">
        <p>Stories are AI-generated and safety-reviewed. Lullawood is designed for parents to share with their children. © {new Date().getFullYear()} Lullawood.</p>
      </div>
    </footer>
  );
}
