"use client";
import { useState } from "react";
import Link from "next/link";
import { Mark } from "@/components/Mark";

const ANIMALS = ["Fox", "Bunny", "Dragon", "Owl", "Whale", "Lion", "Unicorn", "Bear"];

export default function Start() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("5");
  const [animal, setAnimal] = useState("Fox");
  const [email, setEmail] = useState("");
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);

  async function makeStory() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, animal, adventure: "The Forest", color: "green" }),
      });
      const data = await res.json();
      setStory(data.story || "");
      setStep(2);
    } finally { setLoading(false); }
  }

  const [joined, setJoined] = useState(false);
  async function startTrial() {
    const res = await fetch("/api/waitlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "first-story" }),
    });
    if (res.ok) setJoined(true);
  }

  const titleLine = story.split("\n")[0];
  const body = story.slice(titleLine.length).trim();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <Link href="/" className="flex items-center gap-2.5 text-ink"><Mark size={26} /><span className="wordmark text-lg font-semibold">Lullawood</span></Link>

      <div className="mt-10 flex-1">
        {step === 0 && (
          <div className="animate-fade">
            <h1 className="h-display text-3xl font-semibold text-ink">Let&apos;s meet your little one.</h1>
            <p className="mt-2 text-ink-muted">Two minutes, once. Then a story every night.</p>
            <label className="mt-6 block text-[13px] font-bold text-ink-muted">Child&apos;s name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya"
              className="mt-1 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[16px] font-semibold outline-none focus:border-gold" />
            <label className="mt-4 block text-[13px] font-bold text-ink-muted">Age</label>
            <input value={age} onChange={(e) => setAge(e.target.value)} type="number" min={2} max={10}
              className="mt-1 w-28 rounded-2xl border border-border bg-white px-4 py-3 text-[16px] font-semibold outline-none focus:border-gold" />
            <button disabled={!name.trim()} onClick={() => setStep(1)}
              className="mt-6 rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-7 py-3 font-bold text-[#3a2d05] disabled:opacity-60">Next</button>
          </div>
        )}
        {step === 1 && (
          <div className="animate-fade">
            <h1 className="h-display text-3xl font-semibold text-ink">Who do they love?</h1>
            <p className="mt-2 text-ink-muted">Pick a companion for tonight&apos;s first story. You can add more later.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {ANIMALS.map((a) => (
                <button key={a} onClick={() => setAnimal(a)}
                  className={`rounded-full border px-4 py-2 font-semibold ${animal === a ? "border-gold bg-gold/20" : "border-border bg-white text-ink-muted"}`}>{a}</button>
              ))}
            </div>
            <button onClick={makeStory} disabled={loading}
              className="mt-6 rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-7 py-3 font-bold text-[#3a2d05] disabled:opacity-60">
              {loading ? "Writing their first story…" : "Write their first story"}
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="animate-fade">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-peach">Their first story</p>
            <div className="night-panel mt-3 rounded-2xl p-6">
              <h2 className="h-display mb-3 text-2xl italic text-gold">{titleLine}</h2>
              <p className="whitespace-pre-wrap text-[16.5px] leading-[1.75] text-cream">{body}</p>
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-cream-paper p-6">
              <h3 className="h-display text-xl font-semibold text-ink">Have one arrive every night.</h3>
              {joined ? (
                <p className="mt-2 text-[15px] font-bold text-gold-text">✦ You&apos;re on the list — we&apos;ll invite {name || "your little one"}&apos;s family when we open the gates.</p>
              ) : (<>
                <p className="mt-1 text-[15px] text-ink-muted">Lullawood is launching soon. Join the waitlist and we&apos;ll bring {name || "your child"}&apos;s nightly story to your inbox first.</p>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email"
                  className="mt-4 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[16px] font-semibold outline-none focus:border-gold" />
                <button onClick={startTrial} disabled={!email.includes("@")}
                  className="mt-4 w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-7 py-3 font-bold text-[#3a2d05] disabled:opacity-60">Join the waitlist</button>
                <p className="mt-2 text-center text-[12.5px] text-ink-muted/80">Founding families get first access and a founding price.</p>
              </>)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
