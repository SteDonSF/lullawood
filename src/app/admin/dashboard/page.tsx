"use client";

import { useEffect, useState } from "react";

type Code = {
  id: string;
  code: string;
  label: string | null;
  maxRedemptions: number;
  redemptionsUsed: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
};

function StatusPill({ c }: { c: Code }) {
  const usedUp = c.redemptionsUsed >= c.maxRedemptions;
  const label = !c.active ? "Revoked" : usedUp ? "Used up" : "Active";
  const tone = !c.active
    ? "bg-[#f3e3e0] text-[#9a3b2e]"
    : usedUp
    ? "bg-cream-paper text-ink-muted"
    : "bg-[#e8f1e4] text-[#3f6b3a]";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

export default function AdminDashboard() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState("");
  const [justMinted, setJustMinted] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/admin/access-codes");
      if (!r.ok) throw new Error();
      const data = await r.json();
      setCodes(data.codes ?? []);
    } catch {
      setError("Couldn't load codes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function mint() {
    setMinting(true);
    setError("");
    setJustMinted(null);
    try {
      const r = await fetch("/api/admin/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label || undefined,
          maxRedemptions,
          expiresInDays: expiresInDays === "" ? undefined : expiresInDays,
        }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setJustMinted(data?.code?.code ?? null);
      setLabel("");
      setMaxRedemptions(1);
      setExpiresInDays("");
      await load();
    } catch {
      setError("Mint failed.");
    } finally {
      setMinting(false);
    }
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).catch(() => {});
  }

  const inputCls =
    "w-full rounded-2xl border border-border bg-white px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-muted/60 focus:border-[#d8c39a] focus:outline-none focus:ring-2 focus:ring-[rgba(226,161,44,.25)]";
  const labelCls = "mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-ink-muted";

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <h1 className="h-display text-3xl font-semibold text-ink">Reviewer access codes</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Mint a code, send it to a reviewer. They enter it on their dashboard for full Family
            access — 60 days, no card, no charge.
          </p>
        </header>

        <section className="mb-6 rounded-3xl border border-border bg-white p-8 shadow-lift">
          <h2 className="text-[15px] font-semibold text-ink">Mint a code</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Who it&apos;s for</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sarah (mom of 2)" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Max uses</label>
              <input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(Math.max(1, Number(e.target.value)))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Code expires</label>
              <input type="number" min={1} value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Days (optional)" className={inputCls} />
            </div>
          </div>
          <button
            onClick={mint}
            disabled={minting}
            className="mt-5 rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-2.5 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_22px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {minting ? "Minting…" : "Mint code"}
          </button>
          {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
          {justMinted && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#e8d9b5] bg-cream-paper px-4 py-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide text-ink-muted">New code</p>
                <p className="font-mono text-[18px] font-semibold tracking-wide text-ink">{justMinted}</p>
              </div>
              <button
                onClick={() => copy(justMinted)}
                className="shrink-0 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-bold text-ink-muted transition hover:border-[#d8c39a] hover:text-ink"
              >
                Copy
              </button>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Existing codes</h2>
          {loading ? (
            <p className="text-[14px] text-ink-muted">Loading…</p>
          ) : codes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e0d4b8] bg-cream-paper/50 px-6 py-10 text-center">
              <p className="text-[14px] text-ink-muted">No codes yet. Mint your first above.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {codes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-white px-5 py-4 shadow-lift">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[16px] font-semibold tracking-wide text-ink">{c.code}</span>
                      <StatusPill c={c} />
                    </div>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      {c.label ? <span className="text-ink">{c.label}</span> : <span className="italic">No label</span>}
                      {"  ·  "}{c.redemptionsUsed}/{c.maxRedemptions} used
                      {c.expiresAt && `  ·  expires ${new Date(c.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => copy(c.code)}
                    className="shrink-0 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-bold text-ink-muted transition hover:border-[#d8c39a] hover:text-ink"
                  >
                    Copy
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
