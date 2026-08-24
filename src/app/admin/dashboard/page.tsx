"use client";
// =============================================================================
// /admin/dashboard  —  the one page that answers "where do things stand?"
// -----------------------------------------------------------------------------
// Plain tables and numbers, deliberately. No charts: every figure here is one
// you either act on or don't, and a sparkline would only make it prettier to
// misread.
//
// SECURITY: this page is behind Cloudflare Access, but the page being gated is
// NOT what protects the data — /api/admin/* enforces its own wall server-side
// (src/lib/access.ts). A client component cannot keep a secret; the API is the
// boundary. The Plausible API key is never sent here — the funnel arrives
// already aggregated.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { Mark } from "@/components/Mark";

// ---------- shapes (mirror /api/admin/metrics) ----------
type Metric = { today: number; avg7: number };
type Health = {
  activeSubscriptions: Metric; mrrCents: Metric; trialsInFlight: Metric;
  storiesLastNight: Metric; failedPayments: Metric;
  avg7Basis: "measured" | "reconstructed"; snapshotDays: number;
};
type FunnelStep = {
  event: string; count: number;
  fromPrev: number | null; fromTop: number | null; droppedFromPrev: number | null;
};
type Funnel = { ok: boolean; error?: string; period: string; steps: FunnelStep[] };
type Channel = {
  source: string; signups: number; trials: number; paying: number;
  trialToPaidPct: number | null; spendCents: number; cacCents: number | null;
  month3Eligible: number; month3Retained: number; month3Pct: number | null;
};
type Cohort = { cohort: string; size: number; months: (number | null)[] };
type RevenueSlice = { label: string; subs: number; mrrCents: number; sharePct: number | null };
type TrialConversion = { window: string; matured: number; converted: number; pct: number | null };
type Revenue = {
  mrrCents: number; activeSubscriptions: number; arpuCents: number | null;
  byPlan: RevenueSlice[]; byCadence: RevenueSlice[];
  annualMrrSharePct: number | null; annualSubSharePct: number | null;
  totalCollectedCents: number | null; totalCollectedTruncated: boolean;
  totalCollectedError: string | null; totalCollectedCharges: number;
  trialConversion: TrialConversion[];
  churnedMrr30dCents: number; churnedCount30d: number; churnObservable: boolean;
  unknownPriceSubs: number;
};
type Product = {
  storiesPerChildPerWeek: number | null; activeChildren: number; stories7d: number;
  failures24h: number; paywalled402s24h: number; rateLimited429s24h: number;
  medianLatencyMs: number | null; demoFailures24h: number; hasApiEventData: boolean;
};
type Metrics = {
  health: Health; revenue: Revenue; channels: Channel[]; cohorts: Cohort[]; product: Product;
  funnel: Record<string, Funnel>;
  viewer: string | null; accessVerified: boolean; generatedAt: string;
};
type Code = {
  id: string; code: string; label: string | null; maxRedemptions: number;
  redemptionsUsed: number; active: boolean; expiresAt: string | null; createdAt: string;
};

// ---------- formatting ----------
// Sign outside the dollar sign: -$5.06, not $-5.06.
const usd = (c: number) =>
  `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number | null, d = 1) => (v === null ? "—" : `${v.toFixed(d)}%`);
const n1 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const EVENT_LABEL: Record<string, string> = {
  demo_started: "Demo started", demo_completed: "Demo completed",
  signup_started: "Signup started", signup_completed: "Signup completed",
  child_added: "Child added", checkout_started: "Checkout started",
  subscription_active: "Subscription active",
};

// ---------- shared chrome ----------
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="h-display text-[20px] font-semibold text-ink">{title}</h2>
      {sub && <p className="mb-3 mt-0.5 text-[13px] text-ink-muted">{sub}</p>}
      <div className={sub ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

const TH = "border-b border-border px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-muted";
const TD = "border-b border-border/60 px-3 py-2 text-[14px] text-ink";
const TDNUM = `${TD} text-right tabular-nums`;

function Table({ children }: { children: React.ReactNode }) {
  // Wide tables scroll inside their own box rather than pushing the page sideways.
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-lift">
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  );
}

// ---------- 1. health strip ----------
function HealthStrip({ h }: { h: Health }) {
  const cells: { label: string; today: string; avg: string; delta: number | null }[] = [
    { label: "Active subscriptions", today: String(h.activeSubscriptions.today), avg: n1(h.activeSubscriptions.avg7), delta: h.activeSubscriptions.today - h.activeSubscriptions.avg7 },
    { label: "MRR", today: usd(h.mrrCents.today), avg: usd(Math.round(h.mrrCents.avg7)), delta: h.mrrCents.today - h.mrrCents.avg7 },
    { label: "Trials in flight", today: String(h.trialsInFlight.today), avg: n1(h.trialsInFlight.avg7), delta: h.trialsInFlight.today - h.trialsInFlight.avg7 },
    { label: "Stories last night", today: String(h.storiesLastNight.today), avg: n1(h.storiesLastNight.avg7), delta: h.storiesLastNight.today - h.storiesLastNight.avg7 },
    // More failed payments than usual is bad, so the arrow's colour is inverted.
    { label: "Failed payments", today: String(h.failedPayments.today), avg: n1(h.failedPayments.avg7), delta: -(h.failedPayments.today - h.failedPayments.avg7) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cells.map((c) => {
        const up = c.delta !== null && c.delta > 0.05;
        const down = c.delta !== null && c.delta < -0.05;
        return (
          <div key={c.label} className="rounded-2xl border border-border bg-white p-4 shadow-lift">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{c.label}</p>
            <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums text-ink">{c.today}</p>
            <p className="mt-1.5 text-[12px] tabular-nums text-ink-muted">
              7-day avg {c.avg}{" "}
              <span className={up ? "font-bold text-[#3f6b3a]" : down ? "font-bold text-[#9a3b2e]" : "text-ink-muted"}>
                {up ? "▲" : down ? "▼" : "—"}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ---------- 2. funnel ----------
function FunnelTable({ funnel }: { funnel: Record<string, Funnel> }) {
  const [period, setPeriod] = useState("7d");
  const f = funnel[period];

  return (
    <>
      <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-parchment-deep/60 p-1">
        {["7d", "30d", "90d"].map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition ${
              period === p ? "bg-cream-paper text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
            Last {p.replace("d", " days")}
          </button>
        ))}
      </div>

      {!f?.ok && (
        <p className="mb-3 rounded-2xl border border-[#e8d9b5] bg-[#fdf6e6] px-4 py-3 text-[13px] text-ink">
          <strong>Funnel unavailable.</strong> {f?.error ?? "No response from Plausible."}
          {f?.error?.includes("PLAUSIBLE_API_KEY") && (
            <> Set it with <code className="font-mono text-[12px]">wrangler pages secret put PLAUSIBLE_API_KEY --project-name=lullawood</code>, then redeploy.</>
          )}
        </p>
      )}

      <Table>
        <thead>
          <tr>
            <th className={TH}>Step</th>
            <th className={`${TH} text-right`}>Count</th>
            <th className={`${TH} text-right`}>From previous</th>
            <th className={`${TH} text-right`}>From top</th>
            <th className={`${TH} text-right`}>Lost here</th>
          </tr>
        </thead>
        <tbody>
          {(f?.steps ?? []).map((s) => (
            <tr key={s.event}>
              <td className={TD}>{EVENT_LABEL[s.event] ?? s.event}</td>
              <td className={TDNUM}>{s.count.toLocaleString()}</td>
              <td className={TDNUM}>{pct(s.fromPrev)}</td>
              <td className={TDNUM}>{pct(s.fromTop)}</td>
              {/* Drop-off in bodies, not just a percentage — 40% of 5 is not a crisis. */}
              <td className={`${TDNUM} ${s.droppedFromPrev && s.droppedFromPrev > 0 ? "font-semibold text-[#9a3b2e]" : "text-ink-muted"}`}>
                {s.droppedFromPrev === null ? "—" : s.droppedFromPrev > 0 ? `−${s.droppedFromPrev.toLocaleString()}` : "0"}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

// ---------- 3. channel table + spend entry ----------
function ChannelTable({ channels, onSaved }: { channels: Channel[]; onSaved: () => void }) {
  const [source, setSource] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/channel-spend")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.sources) { setSources(d.sources); setSource((s) => s || d.sources[0]); } })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/admin/channel-spend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, month, amount }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.message || d.error || "Save failed."); return; }
      setMsg(d.replaced ? `Replaced ${source} spend for ${month}.` : `Saved ${source} spend for ${month}.`);
      setAmount("");
      onSaved();
    } catch {
      setMsg("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const totals = channels.reduce(
    (a, c) => ({ signups: a.signups + c.signups, trials: a.trials + c.trials, paying: a.paying + c.paying, spend: a.spend + c.spendCents }),
    { signups: 0, trials: 0, paying: 0, spend: 0 }
  );

  const inputCls = "rounded-xl border border-border bg-white px-3 py-2 text-[14px] text-ink focus:border-[#d8c39a] focus:outline-none focus:ring-2 focus:ring-[rgba(226,161,44,.25)]";

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th className={TH}>Source</th>
            <th className={`${TH} text-right`}>Signups</th>
            <th className={`${TH} text-right`}>Trials</th>
            <th className={`${TH} text-right`}>Paying</th>
            <th className={`${TH} text-right`}>Trial→paid</th>
            <th className={`${TH} text-right`}>Spend</th>
            <th className={`${TH} text-right`}>CAC</th>
            <th className={`${TH} text-right`}>Month-3 retained</th>
          </tr>
        </thead>
        <tbody>
          {channels.length === 0 && (
            <tr><td className={TD} colSpan={8}>No signups yet.</td></tr>
          )}
          {channels.map((c) => (
            <tr key={c.source}>
              <td className={`${TD} font-semibold`}>{c.source}</td>
              <td className={TDNUM}>{c.signups.toLocaleString()}</td>
              <td className={TDNUM}>{c.trials.toLocaleString()}</td>
              <td className={TDNUM}>{c.paying.toLocaleString()}</td>
              <td className={TDNUM}>{pct(c.trialToPaidPct)}</td>
              <td className={TDNUM}>{c.spendCents ? usd(c.spendCents) : "—"}</td>
              <td className={TDNUM}>{c.cacCents === null ? "—" : usd(c.cacCents)}</td>
              <td className={TDNUM}>
                {c.month3Pct === null ? (
                  <span className="text-ink-muted">too new</span>
                ) : (
                  <>{pct(c.month3Pct, 0)} <span className="text-[12px] text-ink-muted">({c.month3Retained}/{c.month3Eligible})</span></>
                )}
              </td>
            </tr>
          ))}
          {channels.length > 0 && (
            <tr className="bg-cream-paper/60">
              <td className={`${TD} font-bold`}>All</td>
              <td className={`${TDNUM} font-bold`}>{totals.signups.toLocaleString()}</td>
              <td className={`${TDNUM} font-bold`}>{totals.trials.toLocaleString()}</td>
              <td className={`${TDNUM} font-bold`}>{totals.paying.toLocaleString()}</td>
              <td className={`${TDNUM} font-bold`}>{pct(totals.trials > 0 ? (totals.paying / totals.trials) * 100 : null)}</td>
              <td className={`${TDNUM} font-bold`}>{totals.spend ? usd(totals.spend) : "—"}</td>
              <td className={`${TDNUM} font-bold`}>{totals.paying > 0 && totals.spend > 0 ? usd(Math.round(totals.spend / totals.paying)) : "—"}</td>
              <td className={TDNUM}>—</td>
            </tr>
          )}
        </tbody>
      </Table>

      <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-lift">
        <p className="text-[13px] font-bold text-ink">Log ad spend</p>
        <p className="mb-3 mt-0.5 text-[12.5px] text-ink-muted">
          Typed in monthly — Meta&apos;s API needs app review before it will hand this over.
          Re-submitting a source + month replaces that figure.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="YYYY-MM" className={`${inputCls} w-[110px]`} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount, e.g. 412.30" className={`${inputCls} w-[170px]`} />
          <button onClick={save} disabled={saving || !source || !amount}
            className="rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-5 py-2 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_22px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          {msg && <span className="text-[13px] text-ink-muted">{msg}</span>}
        </div>
      </div>
    </>
  );
}

// ---------- 3. revenue ----------
// A missing number gets a named reason. Showing $0.00 for "we cannot see this"
// is the failure mode this whole page is built to avoid.
function Missing({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-normal italic text-ink-muted">{children}</span>;
}

function RevenuePanel({ r }: { r: Revenue }) {
  const caveats: string[] = [];
  if (r.unknownPriceSubs > 0) {
    caveats.push(
      `${r.unknownPriceSubs} active subscription${r.unknownPriceSubs === 1 ? " is" : "s are"} on a price ID that isn't in the env price map — counted in the subscription total but contributing $0 to MRR. Check STRIPE_PRICE_* against Stripe.`
    );
  }
  if (r.totalCollectedTruncated) {
    caveats.push("Total collected hit the 2,000-charge pagination cap — the figure is a floor, not a total.");
  }

  return (
    <>
      {caveats.map((c) => (
        <p key={c} className="mb-3 rounded-2xl border border-[#e8d9b5] bg-[#fdf6e6] px-4 py-3 text-[13px] text-ink">{c}</p>
      ))}

      {/* Headline figures */}
      <Table>
        <tbody>
          <tr>
            <td className={TD}>MRR<span className="block text-[12px] text-ink-muted">active subscriptions, annual plans divided to a monthly figure</span></td>
            <td className={`${TDNUM} w-[190px] text-[18px] font-semibold`}>{usd(r.mrrCents)}</td>
          </tr>
          <tr>
            <td className={TD}>ARPU<span className="block text-[12px] text-ink-muted">MRR ÷ {r.activeSubscriptions} active subscription{r.activeSubscriptions === 1 ? "" : "s"}</span></td>
            <td className={`${TDNUM} text-[18px] font-semibold`}>
              {r.arpuCents === null ? <Missing>no active subscriptions</Missing> : usd(r.arpuCents)}
            </td>
          </tr>
          <tr>
            <td className={TD}>
              Total collected to date
              <span className="block text-[12px] text-ink-muted">
                net of refunds, from Stripe{r.totalCollectedCharges > 0 ? ` · ${r.totalCollectedCharges} charges` : ""}
              </span>
            </td>
            <td className={`${TDNUM} text-[18px] font-semibold`}>
              {r.totalCollectedCents === null ? (
                <Missing>Stripe unavailable — {r.totalCollectedError}</Missing>
              ) : (
                <>{r.totalCollectedTruncated ? "≥ " : ""}{usd(r.totalCollectedCents)}</>
              )}
            </td>
          </tr>
          <tr>
            <td className={TD}>
              Churned MRR, last 30 days
              <span className="block text-[12px] text-ink-muted">
                paid periods that ended without renewing · {r.churnedCount30d} subscription{r.churnedCount30d === 1 ? "" : "s"}
              </span>
            </td>
            <td className={`${TDNUM} text-[18px] font-semibold`}>
              {!r.churnObservable ? (
                <Missing>no billing period has ended yet</Missing>
              ) : (
                <span className={r.churnedMrr30dCents > 0 ? "text-[#9a3b2e]" : undefined}>
                  {r.churnedMrr30dCents > 0 ? `−${usd(r.churnedMrr30dCents)}` : usd(0)}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className={TD}>Annual vs monthly mix<span className="block text-[12px] text-ink-muted">annual share, by MRR and by subscription count</span></td>
            <td className={`${TDNUM} text-[18px] font-semibold`}>
              {r.annualMrrSharePct === null ? <Missing>no active subscriptions</Missing> : (
                <>{pct(r.annualMrrSharePct, 0)} <span className="text-[13px] font-normal text-ink-muted">of MRR · {pct(r.annualSubSharePct, 0)} of subs</span></>
              )}
            </td>
          </tr>
        </tbody>
      </Table>

      {/* MRR split */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-muted">MRR by plan</p>
          <Table>
            <thead>
              <tr>
                <th className={TH}>Plan</th><th className={`${TH} text-right`}>Subs</th>
                <th className={`${TH} text-right`}>MRR</th><th className={`${TH} text-right`}>Share</th>
              </tr>
            </thead>
            <tbody>
              {r.byPlan.length === 0 && <tr><td className={TD} colSpan={4}><Missing>no active subscriptions yet</Missing></td></tr>}
              {r.byPlan.map((x) => (
                <tr key={x.label}>
                  <td className={`${TD} font-semibold capitalize`}>{x.label}</td>
                  <td className={TDNUM}>{x.subs}</td>
                  <td className={TDNUM}>{usd(x.mrrCents)}</td>
                  <td className={TDNUM}>{pct(x.sharePct, 0)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-muted">MRR by cadence</p>
          <Table>
            <thead>
              <tr>
                <th className={TH}>Cadence</th><th className={`${TH} text-right`}>Subs</th>
                <th className={`${TH} text-right`}>MRR</th><th className={`${TH} text-right`}>Share</th>
              </tr>
            </thead>
            <tbody>
              {r.byCadence.length === 0 && <tr><td className={TD} colSpan={4}><Missing>no active subscriptions yet</Missing></td></tr>}
              {r.byCadence.map((x) => (
                <tr key={x.label}>
                  <td className={`${TD} font-semibold capitalize`}>{x.label}</td>
                  <td className={TDNUM}>{x.subs}</td>
                  <td className={TDNUM}>{usd(x.mrrCents)}</td>
                  <td className={TDNUM}>{pct(x.sharePct, 0)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Trial conversion */}
      <p className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wide text-ink-muted">Trial → paid</p>
      <Table>
        <thead>
          <tr>
            <th className={TH}>Window</th>
            <th className={`${TH} text-right`}>Trials ended</th>
            <th className={`${TH} text-right`}>Converted</th>
            <th className={`${TH} text-right`}>Rate</th>
          </tr>
        </thead>
        <tbody>
          {r.trialConversion.map((t) => (
            <tr key={t.window}>
              <td className={TD}>Last {t.window.replace("d", " days")}</td>
              <td className={TDNUM}>{t.matured}</td>
              <td className={TDNUM}>{t.converted}</td>
              <td className={TDNUM}>
                {t.pct === null ? <Missing>no trial has finished in this window</Missing> : pct(t.pct, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-2 text-[12px] text-ink-muted">
        Only trials that have actually ended count — a trial still running is neither converted nor lost.
      </p>
    </>
  );
}

// ---------- 4. cohort retention ----------
function CohortTable({ cohorts }: { cohorts: Cohort[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th className={TH}>Signup month</th>
          <th className={`${TH} text-right`}>Size</th>
          {[1, 2, 3, 4, 5, 6].map((m) => <th key={m} className={`${TH} text-right`}>M{m}</th>)}
        </tr>
      </thead>
      <tbody>
        {cohorts.length === 0 && <tr><td className={TD} colSpan={8}>No cohorts yet.</td></tr>}
        {cohorts.map((c) => (
          <tr key={c.cohort}>
            <td className={`${TD} font-semibold`}>{c.cohort}</td>
            <td className={TDNUM}>{c.size}</td>
            {c.months.map((v, i) => (
              <td key={i} className={TDNUM}>
                {v === null ? <span className="text-ink-muted/50">·</span> : pct(v, 0)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// ---------- 5. product health ----------
function ProductPanel({ p }: { p: Product }) {
  const rows: [string, string, string?][] = [
    ["Stories per active child per week", p.storiesPerChildPerWeek === null ? "—" : n1(p.storiesPerChildPerWeek),
     `${p.stories7d} stories ÷ ${p.activeChildren} active children`],
    ["Generation failures (24h)", String(p.failures24h), "5xx / broken streams"],
    ["402s — paywalled (24h)", String(p.paywalled402s24h), "no active trial or subscription"],
    ["429s — rate limited (24h)", String(p.rateLimited429s24h), "per-user and per-IP guards"],
    ["Median generation latency", p.medianLatencyMs === null ? "—" : `${(p.medianLatencyMs / 1000).toFixed(1)}s`, "authenticated stories, end to end"],
    ["Demo failures (24h)", String(p.demoFailures24h), "anonymous /try generations that errored"],
  ];
  return (
    <>
      {!p.hasApiEventData && (
        <p className="mb-3 rounded-2xl border border-[#e8d9b5] bg-[#fdf6e6] px-4 py-3 text-[13px] text-ink">
          <strong>No request data in the last 24h yet.</strong> These counters fill from{" "}
          <code className="font-mono text-[12px]">api_events</code>, which starts recording on the next
          story generation after this deploy. Zeroes here mean &ldquo;nothing logged&rdquo;, not &ldquo;nothing happened&rdquo;.
        </p>
      )}
      <Table>
        <tbody>
          {rows.map(([label, value, hint]) => (
            <tr key={label}>
              <td className={TD}>
                {label}
                {hint && <span className="block text-[12px] text-ink-muted">{hint}</span>}
              </td>
              <td className={`${TDNUM} w-[140px] text-[18px] font-semibold`}>{value}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

// ---------- 6. reviewer codes (pre-existing tool, kept) ----------
function AccessCodes() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [label, setLabel] = useState("");
  const [minting, setMinting] = useState(false);
  const [justMinted, setJustMinted] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/access-codes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCodes(d?.codes ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function mint() {
    setMinting(true);
    try {
      const r = await fetch("/api/admin/access-codes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || undefined, maxRedemptions: 1 }),
      });
      const d = await r.json().catch(() => ({}));
      setJustMinted(d?.code?.code ?? null);
      setLabel("");
      load();
    } finally { setMinting(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-[13px] font-bold text-gold underline decoration-dotted underline-offset-4 hover:text-ink">
        + Reviewer access codes
      </button>
    );
  }
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Who it's for"
          className="rounded-xl border border-border bg-white px-3 py-2 text-[14px] text-ink focus:border-[#d8c39a] focus:outline-none" />
        <button onClick={mint} disabled={minting}
          className="rounded-full border border-border bg-white px-5 py-2 text-[13px] font-bold text-ink transition hover:border-[#d8c39a] disabled:opacity-50">
          {minting ? "Minting…" : "Mint code"}
        </button>
        {justMinted && <span className="font-mono text-[15px] font-semibold text-ink">{justMinted}</span>}
      </div>
      <Table>
        <thead>
          <tr>
            <th className={TH}>Code</th><th className={TH}>For</th>
            <th className={`${TH} text-right`}>Used</th><th className={`${TH} text-right`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {codes.length === 0 && <tr><td className={TD} colSpan={4}>No codes yet.</td></tr>}
          {codes.map((c) => (
            <tr key={c.id}>
              <td className={`${TD} font-mono font-semibold`}>{c.code}</td>
              <td className={TD}>{c.label ?? <span className="italic text-ink-muted">—</span>}</td>
              <td className={TDNUM}>{c.redemptionsUsed}/{c.maxRedemptions}</td>
              <td className={`${TDNUM}`}>
                {!c.active ? "Revoked" : c.redemptionsUsed >= c.maxRedemptions ? "Used up" : "Active"}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

// ---------- page ----------
export default function AdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/metrics");
      if (r.status === 403) {
        const d = await r.json().catch(() => ({}));
        setError(`Refused by the admin wall: ${d.reason ?? "forbidden"}`);
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      setM(await r.json());
      setError("");
    } catch {
      setError("Couldn't load metrics.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <a href="/dashboard" className="mb-8 flex items-center gap-2.5">
          <Mark size={28} ring="#D28E28" pine="#2A3422" accent="#D28E28" />
          <span className="wordmark text-[18px] font-semibold text-ink">Lullawood</span>
          <span className="ml-auto eyebrow-caps text-[11px] text-gold-text">Admin</span>
        </a>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="h-display text-3xl font-semibold text-ink">Where things stand</h1>
            <p className="mt-1 text-[14px] text-ink-muted">
              {m ? `Generated ${new Date(m.generatedAt).toLocaleString()}` : "Loading…"}
              {m?.viewer && ` · ${m.viewer}`}
            </p>
          </div>
          <button onClick={load} className="rounded-full border border-border bg-white px-5 py-2 text-[13px] font-bold text-ink-muted transition hover:border-[#d8c39a] hover:text-ink">
            Refresh
          </button>
        </header>

        {error && <p className="mb-6 rounded-2xl border border-[#e8c8c0] bg-[#fdf0ed] px-4 py-3 text-[14px] font-semibold text-[#9a3b2e]">{error}</p>}
        {loading && !m && <p className="text-[14px] text-ink-muted">Loading…</p>}

        {m && (
          <>
            <Section title="Health"
              sub={
                m.health.avg7Basis === "measured"
                  ? "Today against the trailing 7-day average, measured from daily snapshots."
                  : `Today against the trailing 7-day average. Averages are still RECONSTRUCTED from subscription timestamps — accurate for subscriptions that ran a normal course, approximate where a status was later overwritten. ${m.health.snapshotDays}/7 daily snapshots collected; they become measured once the daily cron has run 7 times.`
              }>
              <HealthStrip h={m.health} />
            </Section>

            <Section title="Funnel"
              sub="From Plausible. Conversion is measured step to step; the last column is how many people were lost at that step, in bodies.">
              <FunnelTable funnel={m.funnel} />
            </Section>

            <Section title="Revenue"
              sub="Money in, money out. MRR normalises annual plans to a monthly figure; totals collected come from Stripe, which is the only place payments are recorded.">
              <RevenuePanel r={m.revenue} />
            </Section>

            <Section title="Channel"
              sub="Lifetime signups against lifetime spend, grouped by first-touch source. The reason this page exists.">
              <ChannelTable channels={m.channels} onSaved={load} />
            </Section>

            <Section title="Cohort retention"
              sub="Rows are signup month; columns are months since. A dot means that cohort has not reached that month yet.">
              <CohortTable cohorts={m.cohorts} />
            </Section>

            <Section title="Product health" sub="The last 24 hours of story generation.">
              <ProductPanel p={m.product} />
            </Section>

            <Section title="Tools">
              <AccessCodes />
            </Section>

            <p className="mt-10 border-t border-border pt-4 text-[12px] text-ink-muted">
              Admin API access:{" "}
              {m.accessVerified
                ? "Access JWT cryptographically verified."
                : "host allowlist only — set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD to enable full JWT verification."}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
