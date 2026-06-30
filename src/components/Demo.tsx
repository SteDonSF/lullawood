"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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

// Each chosen companion maps to a recurring Lullawood character illustration.
const ANIMAL_CHAR: Record<string, string> = {
  Fox: "char-fern", Bunny: "char-willow", Dragon: "char-nimbus", Owl: "char-oliver",
  Whale: "char-waverley", Lion: "char-linden", Unicorn: "char-luna", Bear: "char-bramble",
};
function coverImageFor(animal: string) {
  return `/art/${ANIMAL_CHAR[animal] ?? "char-fern"}.webp`;
}

// Split a story body into clean ~150-word pages, breaking ONLY on paragraph
// boundaries — never mid-sentence. Page count is therefore approximate.
function paginate(body: string, target = 85): string[] {
  const hardMax = Math.round(target * 1.4);
  const wc = (s: string): number => (s.trim().match(/\S+/g) || []).length;
  const splitLong = (p: string): string[] => {
    if (wc(p) <= hardMax) return [p];
    const sentences = p.match(/[^.!?]+[.!?]+["'\u201d\u2019)\]]*\s*|[^.!?]+$/g) || [p];
    const out: string[] = [];
    let cur = "";
    let curW = 0;
    for (const s of sentences) {
      const w = wc(s);
      if (curW > 0 && curW + w > target) { out.push(cur.trim()); cur = ""; curW = 0; }
      cur += s; curW += w;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const units = paras.flatMap(splitLong);
  const pages: string[] = [];
  let cur: string[] = [];
  let curWords = 0;
  for (const u of units) {
    const w = wc(u);
    if (cur.length > 0 && curWords + w > hardMax) { pages.push(cur.join("\n\n")); cur = [u]; curWords = w; }
    else { cur.push(u); curWords += w; }
  }
  if (cur.length) pages.push(cur.join("\n\n"));
  return pages.length ? pages : [body.trim()];
}

function GeneratingPanel({ name, animal, adventure }: { name: string; animal: string; adventure: string }) {
  const who = name.trim() || "your child";
  const pal = (animal || "friend").toLowerCase();
  const char = (ANIMAL_CHAR[animal] || "char-fern").replace("char-", "").replace(/^./, (c) => c.toUpperCase());
  const steps = useMemo(() => {
    const s = [`Gathering moonlight and ${char} the ${pal} for ${who}…`];
    if (adventure) s.push(`Tonight's adventure: ${adventure}…`);
    s.push(`Writing ${who} into the story…`);
    s.push("Adding a calm, sleepy ending…");
    s.push("Almost ready…");
    return s;
  }, [who, pal, char, adventure]);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(4);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - t0) / 1000;
      setPct(Math.min(95, 4 + (elapsed / 15) * 91));
      setStep(Math.min(steps.length - 1, Math.floor(elapsed / 3)));
    }, 120);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center text-[#9fb0a4]">
      <div className="animate-pulse-moon h-[54px] w-[54px] rounded-full"
        style={{ background: "radial-gradient(circle at 36% 34%,#F4C95D,#d9af46 55%,#9c7e2f)", boxShadow: "0 0 40px rgba(244,201,93,.4)" }} />
      <p className="min-h-[1.4em] text-[14px]">{steps[step]}</p>
      <div className="h-[5px] w-[200px] max-w-[70%] overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%`, transition: "width .15s linear" }} />
      </div>
    </div>
  );
}

function Chevron({ dir = "right" }: { dir?: "left" | "right" }) {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" aria-hidden="true"
      className="inline-block" style={{ transform: dir === "left" ? "scaleX(-1)" : undefined }}>
      <path d="M1 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

/**
 * StoryBook — a paged, book-style reader for one story.
 * Slides: [cover, ...story pages, footer].
 * Turn pages via Back/Next buttons, left/right arrow keys, or swipe (mobile).
 */
function StoryBook({
  title, body, name, age, animal, footer, ctaName, ctaAge, ctaAnimal,
}: {
  title: string; body: string; name: string; age: string; animal: string;
  footer: "cta" | "example";
  ctaName?: string; ctaAge?: string; ctaAnimal?: string;
}) {
  const pages = useMemo(() => paginate(body), [body]);
  const total = 1 + pages.length + 1; // cover + pages + footer
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);

  const next = () => setI((n) => Math.min(total - 1, n + 1));
  const prev = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -45) next();
    else if (dx > 45) prev();
    touchX.current = null;
  };

  const isCover = i === 0;
  const isFooter = i === total - 1;
  const storyIndex = i - 1; // 0-based index into pages when on a story slide

  return (
    <div className="flex h-full min-h-0 flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="min-h-0 flex-1 overflow-y-auto">
      <div key={i} className="animate-fade flex min-h-full flex-col justify-center">
        {isCover && (
          <div className="text-center">
            <p className="mb-4 text-[12px] font-bold uppercase tracking-wider text-[#7e9488]">
              {footer === "example" ? `An example · for ${name}, age ${age}` : "A Lullawood story"}
            </p>
            <img src={coverImageFor(animal)} alt=""
              className="mx-auto mb-5 h-28 w-28 rounded-full object-cover ring-2 ring-gold/40"
              style={{ boxShadow: "0 0 36px rgba(244,201,93,.25)" }} />
            <h3 className="h-display mb-2 text-2xl font-semibold italic text-gold">{title}</h3>
            <p className="text-[13.5px] text-cream/70">for {name || "your child"}{age ? `, age ${age}` : ""}</p>
            <button type="button" onClick={next}
              className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-white/[.06] px-7 py-2.5 text-[14px] font-bold text-cream transition hover:bg-white/[.12]">
              Begin <Chevron dir="right" />
            </button>
          </div>
        )}

        {!isCover && !isFooter && (
          <div className="space-y-4 text-[16.5px] leading-[1.8] text-cream">
            {pages[storyIndex].split(/\n\s*\n/).map((para, idx) => (
              <p key={idx} className="m-0">{para}</p>
            ))}
          </div>
        )}

        {isFooter && footer === "example" && (
          <div className="text-center">
            <p className="text-[14px] leading-relaxed text-[#9fb0a4]">
              That was just a glimpse. Add your child&apos;s name above for a story made just for them.
            </p>
          </div>
        )}

        {isFooter && footer === "cta" && (
          <div className="lw-cta-card rounded-2xl border border-gold/40 bg-[#fffdf4]/[.07] p-7 text-center" style={{ animation: "lwRise .6s ease-out both" }}>
            <style>{`
              @keyframes lwRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes lwGlow { 0%,100% { box-shadow: 0 10px 28px rgba(226,161,44,.35);} 50% { box-shadow: 0 12px 40px rgba(226,161,44,.6);} }
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
            <a href={ctaName ? `/signup?name=${encodeURIComponent(ctaName)}&age=${encodeURIComponent(ctaAge ?? "")}&animal=${encodeURIComponent(ctaAnimal ?? "")}` : "/signup"}
              className="lw-cta-btn mt-6 inline-block rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-9 py-4 text-[16px] font-bold text-[#3a2d05] transition hover:-translate-y-0.5"
              style={{ animation: "lwGlow 2.8s ease-in-out infinite" }}>
              {ctaName ? `Start ${ctaName}'s free trial` : "Start your free trial"}
            </a>
            <p className="mt-3.5 text-[12.5px] text-cream/55">7 nights free · Cancel anytime · No charge today</p>
          </div>
        )}
      </div>
      </div>

      {/* Page-turn controls */}
      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={prev} disabled={i === 0}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold text-cream/80 transition enabled:hover:text-cream disabled:opacity-25"
          aria-label="Previous page"><Chevron dir="left" />Back</button>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: total }).map((_, d) => (
            <span key={d} className="h-[7px] w-[7px] rounded-full transition"
              style={{ background: d === i ? "#E2A12C" : "rgba(255,253,244,.25)" }} />
          ))}
        </div>

        <button type="button" onClick={next} disabled={i === total - 1}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold text-cream/80 transition enabled:hover:text-cream disabled:opacity-25"
          aria-label={isCover ? "Begin" : "Next page"}>{isCover ? "Begin" : "Next"}<Chevron dir="right" /></button>
      </div>
    </div>
  );
}

const EXAMPLE_TITLE = "Maya and the Tide of Lanterns";
const EXAMPLE_BODY = `Maya had never seen the sea glow before. But tonight, down at Star Harbor, the water shimmered with a thousand tiny lanterns, drifting like sleepy stars.

"Ready?" asked Fern, the little fox, hopping into a boat shaped like a crescent moon. Maya climbed in beside her, and together they pushed off into the soft, dark water.

They floated past Moon Lake, where the waves whispered hello, and a great gentle whale rose up to say goodnight. Maya reached out and touched one of the glowing lanterns — it was warm, like a tiny sun, and it hummed a song just for her.

"You found the brightest one," Fern smiled. "That one's yours to keep."

As the harbor grew quiet and the lanterns dimmed one by one, Maya tucked her glowing lantern close, and Fern curled up at her feet, and the little boat rocked them softly, softly toward sleep.

Goodnight, Lullawood. Goodnight, Maya.`;

export function Demo() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [animal, setAnimal] = useState("Fox");
  const [adventure, setAdventure] = useState("The Ocean");
  const [color, setColor] = useState(COLORS[1]);
  const [length, setLength] = useState(3);
  const [customRequest, setCustomRequest] = useState("");
  const [costarOpen, setCostarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [costarName, setCostarName] = useState("");
  const [costarAge, setCostarAge] = useState("8");
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState("");
  const [error, setError] = useState("");

  // Snapshot of the inputs the current story was generated with (so the cover
  // + CTA stay correct even if the parent edits the form afterwards).
  const [told, setTold] = useState<{ name: string; age: string; animal: string } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  async function generate() {
    setLoading(true); setError(""); setStory("");
    // On mobile the story panel sits below the form — bring it into view.
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
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
      setTold({ name: name.trim(), age, animal });
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    } catch { setError("The storyteller nodded off for a moment. Try once more?"); }
    finally { setLoading(false); }
  }

  const storyTitle = story.split("\n")[0];
  const storyBody = story.slice(storyTitle.length).trim();

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 rounded-3xl border border-border bg-cream-paper p-6 shadow-lift md:grid-cols-2 md:items-start">
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
          {loading ? (name.trim() ? `Writing ${name.trim()}'s story…` : "Writing your story…") : story ? "Write another" : "Read tonight's story"}
        </button>
        <p className="mt-2.5 text-center text-[12.5px] text-ink-muted/80">Free to try. No account, no email.</p>
        <p className="mt-1 text-center text-[12px] font-semibold text-ink-muted/70">
          Every story safety-reviewed · No ads, ever · Cancel anytime
        </p>
      </div>

      {/* the dark night window — always dark */}
      <div ref={panelRef} className="night-panel flex h-[600px] min-h-0 flex-col rounded-2xl p-6" aria-live="polite">
        {loading && (
          <GeneratingPanel name={name} animal={animal} adventure={adventure} />
        )}

        {!loading && error && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center font-semibold text-[#f2a488]">{error}</p>
          </div>
        )}

        {!loading && !error && story && (
          <StoryBook
            key={story}
            title={storyTitle}
            body={storyBody}
            name={told?.name || name.trim()}
            age={told?.age ?? age}
            animal={told?.animal || animal}
            footer="cta"
            ctaName={told?.name || name.trim()}
            ctaAge={told?.age ?? age}
            ctaAnimal={told?.animal || animal}
          />
        )}

        {!loading && !error && !story && (
          <StoryBook
            key="example"
            title={EXAMPLE_TITLE}
            body={EXAMPLE_BODY}
            name="Maya"
            age="6"
            animal="Fox"
            footer="example"
          />
        )}
      </div>
    </div>
  );
}
