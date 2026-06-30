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

export default function AdminDashboard() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[#2a2007]">Reviewer access codes</h1>
      <p className="mt-1 text-sm text-stone-600">
        Mint a code, send it to a reviewer. They enter it on their dashboard to get full (Family) access for 60 days.
      </p>

      <div className="mt-8 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold text-[#2a2007]">Mint a code</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Who it's for (label)"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="number" min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(Math.max(1, Number(e.target.value)))}
            placeholder="Max uses"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="number" min={1}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Code expires (days, optional)"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={mint}
          disabled={minting}
          className="mt-3 rounded-full bg-gradient-to-b from-gold to-[#c47e1e] px-5 py-2 text-sm font-bold text-[#2a2007] disabled:opacity-50"
        >
          {minting ? "Minting…" : "Mint code"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-8">
        <h2 className="font-semibold text-[#2a2007]">Existing codes</h2>
        {loading ? (
          <p className="mt-2 text-sm text-stone-500">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No codes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {codes.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3">
                <div>
                  <span className="font-mono font-semibold text-[#2a2007]">{c.code}</span>
                  {c.label && <span className="ml-2 text-sm text-stone-500">· {c.label}</span>}
                  <div className="text-xs text-stone-500">
                    {c.redemptionsUsed}/{c.maxRedemptions} used
                    {c.expiresAt && ` · expires ${new Date(c.expiresAt).toLocaleDateString()}`}
                    {!c.active && " · revoked"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
