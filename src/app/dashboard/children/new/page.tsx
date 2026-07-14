"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mark } from "@/components/Mark";

function NewChildForm() {
  const params = useSearchParams();
  const seedName = (params.get("name") ?? "").trim();
  const seedAge = (params.get("age") ?? "").trim();
  const seedAnimal = (params.get("animal") ?? "").trim();

  const [name, setName] = useState(seedName);
  const [age, setAge] = useState(seedAge);
  const [animal, setAnimal] = useState(seedAnimal);
  const [interests, setInterests] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [avoid, setAvoid] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Dreamer-at-limit state: message + whether an upgrade path exists (Family isn't top-capped).
  const [atLimit, setAtLimit] = useState<{ message: string; canUpgrade: boolean } | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  // Same checkout flow as the /pricing CTAs: POST /api/checkout -> Stripe hosted URL.
  async function upgradeToFamily() {
    setError("");
    setUpgrading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "family", interval: "monthly" }),
      });
      if (res.status === 401) {
        window.location.href = "/login?next=/dashboard/children/new";
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) {
        setError(d.error || "Couldn't start checkout. Please try again.");
        setUpgrading(false);
        return;
      }
      window.location.href = d.url; // -> Stripe hosted checkout (Family monthly)
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setUpgrading(false);
    }
  }

  async function handleSave() {
    setError("");
    setAtLimit(null);
    if (!name.trim()) { setError("Please enter your child's name."); return; }

    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        age: age.trim(),
        animals: animal.trim() ? [animal.trim()] : [],
        interests,
        aboutText: aboutText.trim(),
        avoidList: avoid,
      }),
    });
    setSaving(false);

    if (res.status === 402) {
      window.location.href = "/pricing";
      return;
    }
    if (res.status === 403) {
      const d = await res.json().catch(() => ({}));
      if (d.error === "child_limit") {
        setAtLimit({
          message: d.message || "You've reached your plan's child limit.",
          canUpgrade: d.plan === "dreamer",
        });
      } else {
        setError(d.message || "You've reached your plan's child limit.");
      }
      return;
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Something went wrong saving. Please try again.");
      return;
    }
    const d = await res.json().catch(() => ({}));
    window.location.href = d.child?.id ? `/dashboard/children/${d.child.id}` : "/dashboard";
  }

  const labelCls = "mb-1 block text-[13px] font-bold text-ink-muted";
  const inputCls =
    "mb-5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <a href="/dashboard" className="mb-6 inline-block text-[13px] font-semibold text-gold hover:underline">
          &larr; Back to dashboard
        </a>

        <div className="rounded-3xl warm-card p-8">
          <a href="/dashboard" aria-label="Back to dashboard" className="mb-4 flex flex-col items-center gap-2">
            <Mark size={40} />
            <span className="wordmark text-[20px] font-semibold text-ink">Lullawood</span>
          </a>
          <h1 className="h-display mb-1 text-center text-2xl font-semibold text-ink">
            {seedName ? `Tell us about ${seedName}` : "Add a child"}
          </h1>
          <p className="mb-6 text-center text-[14px] text-ink-muted">
            The more you share, the more tonight&apos;s story feels like it was written just for them.
          </p>

          <label className={labelCls}>Their name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls}
            placeholder="e.g. Arno" />

          <label className={labelCls}>Their age</label>
          <input value={age} onChange={(e) => setAge(e.target.value)} className={inputCls}
            type="number" min={0} max={18} placeholder="e.g. 8" />

          <label className={labelCls}>Favourite animal or companion</label>
          <input value={animal} onChange={(e) => setAnimal(e.target.value)} className={inputCls}
            placeholder="e.g. fox" />

          <label className={labelCls}>Interests <span className="font-normal">(separate with commas)</span></label>
          <input value={interests} onChange={(e) => setInterests(e.target.value)} className={inputCls}
            placeholder="e.g. soccer, space, dinosaurs" />

          <label className={labelCls}>Tell us about them <span className="font-normal">(in your own words)</span></label>
          <textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)}
            rows={5} maxLength={1200}
            className="mb-5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            placeholder="Their personality, favourite colour, siblings and how they get along, comfort toys, inside jokes, where you live — anything that makes them who they are." />

          <label className={labelCls}>Never include <span className="font-normal">(separate with commas)</span></label>
          <input value={avoid} onChange={(e) => setAvoid(e.target.value)} className={inputCls}
            placeholder="e.g. spiders, thunderstorms" />

          {atLimit && (
            <div className="mb-4 rounded-2xl border border-gold/50 bg-[#fffdf4] p-5 text-center">
              <p className="text-[14.5px] font-semibold text-ink">{atLimit.message}</p>
              {atLimit.canUpgrade && (
                <>
                  <button type="button" onClick={upgradeToFamily} disabled={upgrading}
                    className="mt-3 inline-block rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-7 py-2.5 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_20px_rgba(226,161,44,.35)] transition hover:-translate-y-0.5 disabled:opacity-70">
                    {upgrading ? "Starting…" : "Upgrade to Family →"}
                  </button>
                  <p className="mt-2.5 text-[12px] text-ink-muted">Up to 4 children · sibling co-star stories · $12.99/mo</p>
                </>
              )}
            </div>
          )}

          {error && <p className="mb-4 text-[14px] font-semibold text-[#c2553d]">{error}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-70">
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function NewChildPage() {
  return (
    <Suspense fallback={null}>
      <NewChildForm />
    </Suspense>
  );
}