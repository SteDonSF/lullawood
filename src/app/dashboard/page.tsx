"use client";
import { useEffect, useState } from "react";

export const runtime = "edge";

type Metrics = {
  waitlist: { total: number; bySource: any[]; recent: any[]; daily: any[] };
  demo: { total: number; daily: any[]; picks: any[] };
};

export default function Dashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/admin/metrics")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setM).catch(() => setErr(true));
  }, []);

  if (err) return <Shell><p className="text-ink-muted">Couldn't load metrics. Try refreshing.</p></Shell>;
  if (!m) return <Shell><p className="text-ink-muted">Loading…</p></Shell>;

  const maxDaily = Math.max(1, ...m.waitlist.daily.map((d:any)=>d.n));
  const pick = (kind:string) => m.demo.picks.filter((p:any)=>p.kind===kind);

  return (
    <Shell>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Waitlist signups" value={m.waitlist.total} />
        <Stat label="Stories generated" value={m.demo.total} />
        <Stat label="Sources" value={m.waitlist.bySource.length} />
        <Stat label="Last 30d signups" value={m.waitlist.daily.reduce((a:number,d:any)=>a+d.n,0)} />
      </div>

      <Card title="Signups over time (30 days)">
        {m.waitlist.daily.length === 0 ? <Empty/> :
          <div className="flex items-end gap-1 h-32">
            {m.waitlist.daily.map((d:any,i:number)=>(
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t bg-gold/70" style={{height:`${(d.n/maxDaily)*100}%`}} title={`${d.day}: ${d.n}`}/>
                <span className="text-[9px] text-ink-muted rotate-45 origin-left whitespace-nowrap">{d.day}</span>
              </div>
            ))}
          </div>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Signups by source">
          {m.waitlist.bySource.length === 0 ? <Empty/> :
            <ul className="space-y-2">
              {m.waitlist.bySource.map((s:any,i:number)=>(
                <li key={i} className="flex justify-between text-sm"><span className="text-ink">{s.source}</span><span className="font-bold text-gold-text">{s.n}</span></li>
              ))}
            </ul>}
        </Card>
        <Card title="Most-picked in the demo">
          {["animal","adventure","color"].map(kind=>(
            <div key={kind} className="mb-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted mb-1">{kind}</p>
              <ul className="space-y-1">
                {pick(kind).slice(0,3).map((p:any,i:number)=>(
                  <li key={i} className="flex justify-between text-sm"><span className="text-ink">{p.val}</span><span className="text-ink-muted">{p.n}</span></li>
                ))}
                {pick(kind).length===0 && <li className="text-sm text-ink-muted">—</li>}
              </ul>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Recent signups">
        {m.waitlist.recent.length === 0 ? <Empty/> :
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-muted text-[11px] uppercase tracking-wide">
              <th className="pb-2">Email</th><th className="pb-2">Source</th><th className="pb-2">When</th>
            </tr></thead>
            <tbody>
              {m.waitlist.recent.map((r:any,i:number)=>(
                <tr key={i} className="border-t border-border/50">
                  <td className="py-2 text-ink">{r.email}</td>
                  <td className="py-2 text-ink-muted">{r.source||"—"}</td>
                  <td className="py-2 text-ink-muted">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>}
      </Card>
    </Shell>
  );
}

function Shell({children}:{children:React.ReactNode}) {
  return <main className="min-h-screen bg-cream px-6 py-10"><div className="mx-auto max-w-5xl">
    <h1 className="font-display text-3xl text-ink mb-1">Lullawood</h1>
    <p className="text-ink-muted mb-8">Founder dashboard</p>
    <div className="space-y-4">{children}</div>
  </div></main>;
}
function Stat({label,value}:{label:string;value:number}) {
  return <div className="rounded-2xl border border-border bg-cream-paper p-5 shadow-page">
    <p className="text-3xl font-bold text-ink">{value}</p><p className="text-[12px] text-ink-muted mt-1">{label}</p>
  </div>;
}
function Card({title,children}:{title:string;children:React.ReactNode}) {
  return <div className="rounded-2xl border border-border bg-cream-paper p-5 shadow-page">
    <h2 className="font-display text-lg text-ink mb-4">{title}</h2>{children}</div>;
}
function Empty(){ return <p className="text-sm text-ink-muted">No data yet.</p>; }
