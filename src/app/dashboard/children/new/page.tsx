"use client";
// =============================================================================
// /dashboard/children/new  —  Add-a-child profile form (Phase 2)
// -----------------------------------------------------------------------------
// WHAT: The make-or-break onboarding moment. A logged-in parent describes their
//   child; on submit we POST to /api/profile (which derives parentId from the
//   server session) and return to /dashboard where the new child appears.
// TALKS TO: POST /api/profile  ·  redirects to /dashboard
// SHAPE (the "middle route"): structured fields for what must be guaranteed
//   (name, exact age, favourite animal/companion) + free text for what's rich
//   (interests, the living-portrait box, the avoid-list). See ROADMAP §3/§4.
//
// LULLAWOOD-FUTURE: fields to promote out of free text as they earn their place —
//   (a) sibling/cast relationship fields (named siblings/friends/pets) — feeds
//       the Growing Cast (ROADMAP §10); these are the next structured fields.
//   (b) bedtime + timezone (nightly-delivery, Phase 6).
//   (c) length default (set once; nightly choice becomes the override).
//   (d) colour is intentionally folded into the free-text box for now.
// LULLAWOOD-FUTURE: "describe in your own words" could gain voice input (§3) —
//   a tired parent speaks more easily than types. High value, later.
// =============================================================================
import { useState } from "react";

export default function NewChildPage() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [animal, setAnimal] = useState("");      // structured: favourite companion (anchors recurring character)
  const [interests, setInterests] = useState(""); // comma-separated, free-ish
  const [aboutText, setAboutText] = useState(""); // the living portrait — engine mines this
  const [avoid, setAvoid] = useState("");         // "never include" — comma-separated

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (!name.trim()) { setError("Please enter your child's name."); return; }

    setSaving(true);
    // NOTE: parentId is NOT sent — the server derives it from the session.
    // animals[] carries the single structured companion for now; interests is
    // comma-split server-side; avoidList is the "never include" array.
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

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Something went wrong saving. Please try again.");
      return;
    }
    window.location.href = "/dashboard";
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

        <div className="rounded-3xl border border-border bg-white p-8 shadow-lift">
          <h1 className="h-display mb-1 text-2xl font-semibold text-ink">Add a child</h1>
          <p className="mb-6 text-[14px] text-ink-muted">
            Tell Lullawood who they are. The more you share, the more tonight&apos;s story
            feels like it was written just for them.
          </p>

          <label className={labelCls}>Their name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls}
            placeholder="e.g. Arno" />

          <label className={labelCls}>Their age</label>
          <input value={age} onChange={(e) => setAge(e.target.value)} className={inputCls}
            type="number" min={0} max={18} placeholder="e.g. 8" />

          {/* structured: favourite animal/companion — anchors the recurring character (Growing Cast §10) */}
          <label className={labelCls}>Favourite animal or companion</label>
          <input value={animal} onChange={(e) => setAnimal(e.target.value)} className={inputCls}
            placeholder="e.g. fox" />

          <label className={labelCls}>Interests <span className="font-normal">(separate with commas)</span></label>
          <input value={interests} onChange={(e) => setInterests(e.target.value)} className={inputCls}
            placeholder="e.g. soccer, space, dinosaurs" />

          {/* the living portrait — the rich free-text the engine mines (ROADMAP §3) */}
          <label className={labelCls}>Tell us about them <span className="font-normal">(in your own words)</span></label>
          <textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)}
            rows={5} maxLength={1200}
            className="mb-5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            placeholder="Their personality, favourite colour, siblings and how they get along, comfort toys, inside jokes, where you live — anything that makes them them." />

          {/* the avoid-list — structured "never include", must never be missed */}
          <label className={labelCls}>Never include <span className="font-normal">(separate with commas)</span></label>
          <input value={avoid} onChange={(e) => setAvoid(e.target.value)} className={inputCls}
            placeholder="e.g. spiders, thunderstorms" />

          {error && <p className="mb-4 text-[14px] font-semibold text-[#c2553d]">{error}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-70">
            {saving ? "Saving…" : "Save child"}
          </button>
        </div>
      </div>
    </main>
  );
}