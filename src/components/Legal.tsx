import Link from "next/link";
import { Mark } from "./Mark";

export function Legal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="flex items-center gap-2 text-ink">
        <Mark size={24} /><span className="wordmark text-lg font-semibold">Lullawood</span>
      </Link>
      <h1 className="h-display mt-8 text-3xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-[13px] text-ink-muted">Last updated {updated}</p>
      <div className="mt-8 space-y-4 text-[15.5px] leading-relaxed text-ink-soft [&_h2]:font-display [&_h2]:text-ink [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-gold-text [&_a]:underline [&_strong]:text-ink">
        {children}
      </div>
      <p className="mt-12 border-t border-border pt-6 text-[13px] text-ink-muted">
        Questions about this policy? Email <a className="text-gold-text underline" href="mailto:hello@lullawood.com">hello@lullawood.com</a>.
      </p>
    </main>
  );
}
