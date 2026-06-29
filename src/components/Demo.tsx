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
const LENGTHS = [
  { label: "Short", min: 3, hint: "~3 min" },
  { label: "Medium", min: 5, hint: "~5 min" },
  { label: "Long", min: 7, hint: "~7 min" },
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
  const [age, setAge] = useState("");
  const [animal, setAnimal] = useState("Fox");
  const [adventure, setAdventure] = useState("The Ocean");
  const [color, setColor] = useState(COLORS[1]);
  const [length, setLength] = useState(5);
  const [customRequest, setCustomRequest] = useState("");
  const [costarOpen, setCostarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [costarName, setCostarName] = useState("");
  const [costarAge, setCostarAge] = useState("8");
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
      const ageNum = Math.max(1, Math.min(12, parseInt(age, 10) || 6));
      const costar = costarOpen && costarName.trim()
        ? { name: costarName.trim().slice(0, 24), age: Math.max(1, Math.min(12, parseInt(costarAge, 10) || ageNum)) }
        : undefined;
      const res = await fetch("/api/generate-story", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), age: ageNum, animal, adventure, color: color.name,
          targetMinutes: length,
          customRequest: customRequest.trim().slice(0, 600) || undefined,
          costar,
        }),
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
        {/* Name + age on one row */}
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="lw-name" className="mt-2.5 text-[13px] font-bold text-ink-muted">Your child&apos;s name</label>
            <input id="lw-name" value={name} maxLength={24} placeholder="e.g. Maya"
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()}
              className="rounded-2xl border border-border bg-white px-4 py-3 text-[16px] font-semibold text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
          </div>
          <div className="flex w-[88px] flex-col gap-2">
            <label htmlFor="lw-age" className="mt-2.5 text-[13px] font-bold text-ink-muted">Age</label>
            <input id="lw-age" value={age} inputMode="numeric" placeholder="6"
              onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-center text-[16px] font-semibold text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
          </div>
        </div>

        <span className="mt-2.5 text-[13px] font-bold text-ink-muted">A friendly companion</span>
        <div className="flex flex-wrap gap-2">{ANIMALS.map((a) => <Chip key={a} active={animal === a} onClick={() => setAnimal(a)}>{a}</Chip>)}</div>
        <span className="mt-2.5 text-[13px] font-bold text-ink-muted">Tonight&apos;s adventure</span>
        <div className="flex flex-wrap gap-2">{ADVENTURES.map((a) => <Chip key={a} active={adventure === a} onClick={() => setAdventure(a)}>{a}</Chip>)}</div>

        {!moreOpen && (
          <button type="button" onClick={() => setMoreOpen(true)}
            className="mt-3 self-start text-[13px] font-bold text-gold underline decoration-dotted underline-offset-4 hover:text-ink">
            + More options (colour, length, your own adventure)
          </button>
        )}
        {moreOpen && (<>

        {/* Free-text: describe your own adventure */}
        <span className="mt-2.5 text-[13px] font-bold text-ink-muted">…or describe your own adventure <span className="font-semibold text-ink-muted/70">(optional)</span></span>
        <textarea value={customRequest} maxLength={600} rows={2}
          placeholder="e.g. Arno and Leo win the cup final against Sleepy Hollow United"
          onChange={(e) => setCustomRequest(e.target.value)}
          className="resize-none rounded-2xl border border-border bg-white px-4 py-3 text-[15px] font-medium text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />

        <span className="mt-2.5 text-[13px] font-bold text-ink-muted">A favourite colour</span>
        <div className="flex flex-wrap gap-2">{COLORS.map((c) => <Chip key={c.name} active={color.name === c.name} onClick={() => setColor(c)} dot={c.hex}>{c.name}</Chip>)}</div>

        {/* Story length */}
        <span className="mt-2.5 text-[13px] font-bold text-ink-muted">Story length</span>
        <div className="flex flex-wrap gap-2">
          {LENGTHS.map((l) => (
            <Chip key={l.min} active={length === l.min} onClick={() => setLength(l.min)}>
              {l.label} <span className="font-semibold text-ink-muted/70">{l.hint}</span>
            </Chip>
          ))}
        </div>
        <button type="button" onClick={() => setMoreOpen(false)}
          className="mt-3 self-start text-[13px] font-bold text-ink-muted underline decoration-dotted underline-offset-4 transition hover:text-ink">
          − Fewer options
        </button>
        </>)}

        {/* Optional co-star */}
        {!costarOpen ? (
          <button type="button" onClick={() => setCostarOpen(true)}
            className="mt-3 self-start text-[13px] font-bold text-ink-muted underline decoration-dotted underline-offset-4 transition hover:text-ink">
            + Add a brother or sister
          </button>
        ) : (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-border bg-white/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-ink-muted">And a brother or sister</span>
              <button type="button" onClick={() => { setCostarOpen(false); setCostarName(""); }}
                className="text-[12px] font-bold text-ink-muted/70 hover:text-ink">Remove</button>
            </div>
            <div className="flex gap-3">
              <input value={costarName} maxLength={24} placeholder="e.g. Leo"
                onChange={(e) => setCostarName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()}
                className="flex-1 rounded-2xl border border-border bg-white px-4 py-2.5 text-[15px] font-semibold text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
              <input value={costarAge} inputMode="numeric" placeholder="8"
                onChange={(e) => setCostarAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                onKeyDown={(e) => e.key === "Enter" && generate()}
                className="w-[72px] rounded-2xl border border-border bg-white px-3 py-2.5 text-center text-[15px] font-semibold text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
            </div>
          </div>
        )}

        <button type="button" onClick={generate} disabled={loading}
          className="mt-4 w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70">
          {loading ? "Lighting the lamps…" : story ? "Write another" : "Read tonight's story"}
        </button>
        <p className="mt-2.5 text-center text-[12.5px] text-ink-muted/80">Free to try. No account, no email.</p>
      </div>

      {/* the dark night window — always dark */}
      <div className="night-panel flex min-h-[380px] flex-col justify-center rounded-2xl p-6" aria-live="polite">
        {!story && !loading && !error && (
          <div className="animate-fade">
            <p className="mb-4 text-center text-[12px] font-bold uppercase tracking-wider text-[#7e9488]">An example</p>
            <h3 className="h-display mb-3 text-center text-xl font-semibold italic text-gold">Willow and the Quiet Lantern</h3>
            <p className="m-0 whitespace-pre-wrap text-[15.5px] leading-[1.7] text-cream/90">
              {`When the moon rose over Lantern Village, Willow the rabbit found a lantern that had forgotten how to glow. "Don't worry," she whispered. "We'll find your light together."

They walked the soft path to Moon Lake, past the sleeping willows, until the water lay still as glass. Willow held the lantern to the moon — and slowly, gently, it began to shine again, warm and golden.

"There you are," she smiled. The lantern hummed softly, happy and sleepy all at once.

And as the village dimmed and the stars settled in, Willow curled up in the clover, and the little lantern glowed beside her, soft and low.

Goodnight, Lullawood. Goodnight, little one.`}
            </p>
            <p className="mt-5 text-center text-[12.5px] text-[#9fb0a4]">↑ This is just an example. Add your child above for their own.</p>
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
            <div
              className="lw-cta-card mt-9 rounded-2xl border border-gold/40 bg-[#fffdf4]/[.07] p-7 text-center"
              style={{ animation: "lwRise .6s ease-out both" }}
            >
              <style>{`
                @keyframes lwRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes lwGlow {
                  0%, 100% { box-shadow: 0 10px 28px rgba(226,161,44,.35); }
                  50% { box-shadow: 0 12px 40px rgba(226,161,44,.6); }
                }
                @media (prefers-reduced-motion: reduce) {
                  .lw-cta-card { animation: none !important; }
                  .lw-cta-btn { animation: none !important; box-shadow: 0 10px 28px rgba(226,161,44,.4) !important; }
                }
              `}</style>
              <p className="h-display text-[20px] font-semibold text-cream">
                <span className="text-gold">✦</span> That was just one night in Lullawood <span className="text-gold">✦</span>
              </p>
              <p className="mx-auto mt-2.5 max-w-md text-[14.5px] leading-relaxed text-cream/75">
                Every night, a brand-new story — one that remembers tonight&apos;s adventure and grows as they do.
              </p>
              <a
                href={name ? `/signup?name=${encodeURIComponent(name)}&age=${encodeURIComponent(age)}&animal=${encodeURIComponent(animal)}` : "/signup"}
                className="lw-cta-btn mt-6 inline-block rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-9 py-4 text-[16px] font-bold text-[#3a2d05] transition hover:-translate-y-0.5"
                style={{ animation: "lwGlow 2.8s ease-in-out infinite" }}
              >
                {name ? `Start ${name}'s free trial` : "Start your free trial"}
              </a>
              <p className="mt-3.5 text-[12.5px] text-cream/55">7 nights free · Cancel anytime · No charge today</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
