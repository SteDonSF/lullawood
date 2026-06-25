"use client";
import { useEffect, useState } from "react";
import { Mark } from "./Mark";
import { DEMO } from "@/lib/content";

const ANIMALS = ["Fox", "Bunny", "Dragon", "Owl", "Whale", "Lion", "Unicorn", "Bear"];
const ADVENTURES = ["The Ocean", "Space", "Dinosaurs", "A Castle", "The Forest", "Trains", "Football", "Baking"];
const COLORS = [
  { name: "blue", hex: "#6FA8DC" }, { name: "gold", hex: "#E2A12C" }, { name: "green", hex: "#6FB17E" },
  { name: "teal", hex: "#3FA3A3" }, { name: "peach", hex: "#E0815C" }, { name: "purple", hex: "#9B7BD4" },
];

function Chip({ active, onClick, children, dot }: { active: boolean; onClick: () => void; children: React.ReactNode; dot?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13.5px] font-semibold transition ${
        active ? "border-gold bg-gold/20 text-ink" : "border-border bg-white text-ink-muted hover:border-[#d8c39a] hover:text-ink"}`}>
      {dot && <span className="inline-block h-[11px] w-[11px] rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}

export function Demo() {
  const [name, setName] = useState("");
  const [animal, setAnimal] = useState("Fox");
  const [adventure, setAdventure] = useState("The Ocean");
  const [color, setColor] = useState(COLORS[1]);
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState("");
  const [shown, setShown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!story) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(story.length); return; }
    setShown(0); let i = 0;
    const id = setInterval(() => { i += 2; setShown((s) => Math.min(story.length, s + 2)); if (i >= story.length) clearInterval(id); }, 16);
    return () => clearInterval(id);
  }, [story]);

  async function generate() {
    setLoading(true); setError(""); setStory(""); setShown(0);
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), animal, adventure, color: color.name }),
      });
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      if (!data.story) throw new Error("empty");
      setStory(data.story as string);
    } catch { setError("The storyteller nodded off for a moment. Try once more?"); }
    finally { setLoading(false); }
  }

  const titleLine = story.split("\n")[0];
  const body = story.slice(titleLine.length).trim();
  const visible = body.slice(0, Math.max(0, shown - titleLine.length));

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 rounded-3xl border border-border bg-cream-paper p-6 shadow-lift md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="lw-name" className="mt-2.5 text-[13px] font-bold text-ink-muted">Your child&apos;s name</label>
        <input id="lw-name" value={name} maxLength={24} placeholder="e.g. Maya"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()}
          className="rounded-2xl border border-border bg-white px-4 py-3 text-[16px] font-semibold text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
        <span className="mt-2.5 text-[13px] font-bold text-ink-muted">A friendly companion</span>
        <div className="flex flex-wrap gap-2">{ANIMALS.map((a) => <Chip key={a} active={animal === a} onClick={() => setAnimal(a)}>{a}</Chip>)}</div>
        <span className="mt-2.5 text-[13px] font-bold text-ink-muted">Tonight&apos;s adventure</span>
        <div className="flex flex-wrap gap-2">{ADVENTURES.map((a) => <Chip key={a} active={adventure === a} onClick={() => setAdventure(a)}>{a}</Chip>)}</div>
        <span className="mt-2.5 text-[13px] font-bold text-ink-muted">A favourite colour</span>
        <div className="flex flex-wrap gap-2">{COLORS.map((c) => <Chip key={c.name} active={color.name === c.name} onClick={() => setColor(c)} dot={c.hex}>{c.name}</Chip>)}</div>
        <button type="button" onClick={generate} disabled={loading}
          className="mt-4 w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70">
          {loading ? "Lighting the lamps…" : story ? "Write another" : "Read tonight's story"}
        </button>
        <p className="mt-2.5 text-center text-[12.5px] text-ink-muted/80">Free to try. No account, no email.</p>
      </div>

      {/* the dark night window — always dark */}
      <div className="night-panel flex min-h-[380px] flex-col justify-center rounded-2xl p-6" aria-live="polite">
        {!story && !loading && !error && (
          <div className="flex flex-col items-center gap-4 text-center text-[#9fb0a4]">
            <Mark size={54} pine="#E9E2D0" /><p>Your child&apos;s first visit to Lullawood will appear here.</p>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center gap-4 text-center text-[#9fb0a4]">
            <div className="animate-pulse-moon h-[54px] w-[54px] rounded-full"
              style={{ background: "radial-gradient(circle at 36% 34%,#F4C95D,#d9af46 55%,#9c7e2f)", boxShadow: "0 0 40px rgba(244,201,93,.4)" }} />
            <p>Gathering moonlight and a {animal.toLowerCase()}…</p>
          </div>
        )}
        {error && <p className="text-center font-semibold text-[#f2a488]">{error}</p>}
        {story && (
          <div className="animate-fade">
            <h3 className="h-display mb-3.5 text-2xl font-semibold italic text-gold">{titleLine}</h3>
            <p className="m-0 whitespace-pre-wrap text-[16.5px] leading-[1.75] text-cream">
              {visible}{shown < story.length && <span className="caret" />}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
