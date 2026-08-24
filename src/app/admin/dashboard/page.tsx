"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/Mark";

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

// One PageSpeed Insights measurement, as /api/admin/metrics returns it
// (snake_case, straight from the page_speed table).
type SpeedRow = {
  path: string;
  strategy?: string;
  performance_score: number | null;
  lcp_ms: number | null;
  tbt_ms: number | null;
  ttfb_ms: number | null;
  created_at: string;
};

// Mirrors CONFIG.pageSpeed in src/app/api/cron/health-check/route.ts — these
// are only for colouring the numbers here; the alert itself is decided there.
const SPEED_LIMITS = { maxLcpMs: 3500, minScore: 50 };

// Postgres `timestamp` comes back as "2026-08-24 14:00:00" (no zone marker) and
// is stored in UTC — spell that out so the browser doesn't read it as local.
function parseStamp(v: string): Date {
  return new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v.replace(" ", "T")}Z`);
}

const ms = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`);

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
  const [speedLatest, setSpeedLatest] = useState<SpeedRow[]>([]);
  const [speedRuns, setSpeedRuns] = useState<SpeedRow[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);

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

  // Product health — the last 7 days of PageSpeed runs written by the daily
  // health-check cron. Loaded separately so a metrics hiccup never blocks the
  // access-code tools above.
  async function loadHealth() {
    try {
      const r = await fetch("/api/admin/metrics");
      if (!r.ok) throw new Error();
      const data = await r.json();
      setSpeedLatest(data?.pageSpeed?.latest ?? []);
      setSpeedRuns(data?.pageSpeed?.runs ?? []);
    } catch {
      /* leave the section in its empty state */
    } finally {
      setHealthLoading(false);
    }
  }

  useEffect(() => { load(); loadHealth(); }, []);

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
        <a href="/dashboard" className="mb-8 flex items-center gap-2.5">
          <Mark size={28} ring="#D28E28" pine="#2A3422" accent="#D28E28" />
          <span className="wordmark text-[18px] font-semibold text-ink">Lullawood</span>
          <span className="ml-auto eyebrow-caps text-[11px] text-gold-text">A new story every night</span>
        </a>
        <header className="mb-8">
          <h1 className="h-display text-3xl font-semibold text-ink">Reviewer access codes</h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Mint a code, send it to a reviewer. They enter it on their dashboard for full Family
            access — 60 days, no card, no charge.
          </p>
        </header>

        <section className="mb-6 rounded-3xl warm-card p-8">
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

        <section className="mt-10">
          <h2 className="mb-1 text-[15px] font-semibold text-ink">Product health</h2>
          <p className="mb-3 text-[13px] text-ink-muted">
            PageSpeed Insights (mobile), measured every morning by the health-check cron. It emails
            only when something breaches a threshold — LCP over {(SPEED_LIMITS.maxLcpMs / 1000).toFixed(1)}s
            or a score under {SPEED_LIMITS.minScore}.
          </p>

          {healthLoading ? (
            <p className="text-[14px] text-ink-muted">Loading…</p>
          ) : speedRuns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e0d4b8] bg-cream-paper/50 px-6 py-10 text-center">
              <p className="text-[14px] text-ink-muted">
                No measurements yet — the first run lands at 7am PT.
              </p>
            </div>
          ) : (
            <>
              {/* Where we stand today: the most recent run per page. */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {speedLatest.map((r) => {
                  const scoreBad = r.performance_score != null && r.performance_score < SPEED_LIMITS.minScore;
                  const lcpBad = r.lcp_ms != null && r.lcp_ms > SPEED_LIMITS.maxLcpMs;
                  return (
                    <div key={r.path} className="rounded-2xl border border-border bg-white px-5 py-4 shadow-lift">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-[14px] font-semibold text-ink">{r.path}</span>
                        <span className={`text-[26px] font-semibold leading-none ${scoreBad ? "text-[#9a3b2e]" : "text-[#3f6b3a]"}`}>
                          {r.performance_score ?? "—"}
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                        <div>
                          <dt className="text-ink-muted">LCP</dt>
                          <dd className={`font-semibold ${lcpBad ? "text-[#9a3b2e]" : "text-ink"}`}>{ms(r.lcp_ms)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">TBT</dt>
                          <dd className="font-semibold text-ink">{ms(r.tbt_ms)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">TTFB</dt>
                          <dd className="font-semibold text-ink">{ms(r.ttfb_ms)}</dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-[11px] text-ink-muted">
                        Measured {parseStamp(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* The trend behind it — every run in the last 7 days, newest first. */}
              <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-lift">
                <table className="w-full min-w-[420px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2.5 font-bold">Day</th>
                      <th className="px-4 py-2.5 font-bold">Page</th>
                      <th className="px-4 py-2.5 text-right font-bold">Score</th>
                      <th className="px-4 py-2.5 text-right font-bold">LCP</th>
                      <th className="px-4 py-2.5 text-right font-bold">TBT</th>
                      <th className="px-4 py-2.5 text-right font-bold">TTFB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {speedRuns.map((r, i) => {
                      const scoreBad = r.performance_score != null && r.performance_score < SPEED_LIMITS.minScore;
                      const lcpBad = r.lcp_ms != null && r.lcp_ms > SPEED_LIMITS.maxLcpMs;
                      return (
                        <tr key={`${r.path}-${r.created_at}-${i}`} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-2.5 text-ink-muted">
                            {parseStamp(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-ink">{r.path}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${scoreBad ? "text-[#9a3b2e]" : "text-ink"}`}>
                            {r.performance_score ?? "—"}
                          </td>
                          <td className={`px-4 py-2.5 text-right ${lcpBad ? "font-semibold text-[#9a3b2e]" : "text-ink"}`}>{ms(r.lcp_ms)}</td>
                          <td className="px-4 py-2.5 text-right text-ink">{ms(r.tbt_ms)}</td>
                          <td className="px-4 py-2.5 text-right text-ink">{ms(r.ttfb_ms)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
