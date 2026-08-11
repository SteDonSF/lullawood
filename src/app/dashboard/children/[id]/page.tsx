"use client";
export const runtime = "edge";
// =============================================================================
// /dashboard/children/[id]  —  Single child view (Phase 2)
// -----------------------------------------------------------------------------
// WHAT: A parent taps a child on the dashboard and lands here. Shows the saved
//   profile (who Lullawood knows them to be) and is the launch point for
//   "Write tonight's story" — the first thing the product does that the
//   anonymous demo cannot, because it generates FROM the saved profile.
// TALKS TO:
//   GET  /api/profile/[id]      -> load this child (ownership-checked)
//   POST /api/generate-story    -> generate a story for this child (File 4 wires
//                                  this to read the saved profile by childId)
// SESSION: page is session-gated (no session -> redirect to /login), and the
//   API it calls is itself session-scoped, so this is defence in depth.
//
// LULLAWOOD-FUTURE (Phase 3 memory): once stories are saved + summarised, show
//   a "Past adventures" list here, and pass recent summaries into generation so
//   tonight builds on last night. This page is where "Lullawood remembers"
//   becomes visible to the parent.
// LULLAWOOD-FUTURE: "Edit profile" button -> PATCH /api/profile/[id] (see that
//   route's FUTURE note). Also: per-night length override + "anything happen
//   today?" day-processing box (ROADMAP §3) belong here, above the generate button.
// LULLAWOOD-FUTURE (Phase 7 audio): a "Read aloud" control sits next to the story.
// =============================================================================
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Mark } from "@/components/Mark";
import { relativeNight } from "@/lib/relative-date";

type Child = {
  id: string;
  name: string;
  age: number | null;
  animals: string[] | null;
  interests: string[] | null;
  aboutText: string | null;
  avoidList: string[] | null;
};

type HistoryStory = {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  createdAt: string;
  isNightly: boolean;
};

function historyTitle(s: HistoryStory): string {
  if (s.title && s.title.trim()) return s.title.trim();
  const first = s.body.split("\n").map((l) => l.trim()).find(Boolean);
  return first || "A Lullawood story";
}

export default function ChildViewPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { data: session, isPending } = useSession();

  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // story generation state. `story` holds the raw streamed text (first line = the
  // title, the rest the body); we derive title/body at render.
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState(false); // true once the first chunk arrives
  const [story, setStory] = useState<string>("");
  const [genError, setGenError] = useState("");
  const [tonight, setTonight] = useState("");

  // tonight's ready-and-waiting nightly story (delivered by the cron)
  const [waitingStory, setWaitingStory] = useState<{ title: string; body: string } | null>(null);

  // recent story history (last 3) + total, for the "Story history" section
  const [history, setHistory] = useState<HistoryStory[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);

  useEffect(() => {
    if (!session || !id) return;
    fetch(`/api/profile/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (d?.child) setChild(d.child);
        if (d?.todaysStory) setWaitingStory({ title: d.todaysStory.title, body: d.todaysStory.body });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [session, id]);

  useEffect(() => {
    if (!session || !id) return;
    fetch(`/api/stories/${id}?limit=3`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setHistory(d.stories ?? []);
        setHistoryTotal(d.total ?? 0);
      })
      .catch(() => { /* history is non-critical — silently skip on error */ });
  }, [session, id]);

  // Open the already-generated nightly story in the reader — no generation. The
  // reader derives title/body from `story` (first line = title), so join them.
  function readWaitingStory() {
    if (!waitingStory) return;
    setGenError("");
    setStory(`${waitingStory.title}\n\n${waitingStory.body}`);
  }

  async function writeStory() {
    setGenError("");
    setStory("");
    setStreaming(false);
    setGenerating(true);
    // /api/generate-story reads the childId, builds the prompt from the saved
    // profile, and STREAMS the story text back (text/event-stream).
    let acc = "";
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: id, adventure: tonight.trim() || undefined }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        setGenError(d.error || "Couldn't write a story just now. Please try again.");
        return;
      }
      // Read the stream: first chunk flips the spinner to growing text.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let started = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        acc += chunk;
        if (!started) { started = true; setStreaming(true); }
        setStory(acc);
      }
      acc += decoder.decode();
      if (!acc.trim()) throw new Error("empty");
      setStory(acc);
    } catch {
      // If usable text arrived before the break, keep it; else show the error.
      if (acc.trim().length > 40) {
        setStory(acc);
        setGenError("The story was cut short — tap “Write another” to try again.");
      } else {
        setGenError("Couldn't write a story just now. Please try again.");
        setStory("");
      }
    } finally {
      setGenerating(false);
      setStreaming(false);
    }
  }

  if (isPending || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-paper">
        <p className="text-ink-muted">Loading…</p>
      </main>
    );
  }

  if (!session) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-paper">
        <p className="text-ink-muted">Redirecting to log in…</p>
      </main>
    );
  }

  if (notFound || !child) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-paper px-4">
        <div className="text-center">
          <p className="mb-3 text-ink">We couldn&apos;t find that child.</p>
          <a href="/dashboard" className="font-bold text-gold hover:underline">Back to dashboard</a>
        </div>
      </main>
    );
  }

  const chips = [
    ...(child.animals ?? []),
    ...(child.interests ?? []),
  ].filter(Boolean);

  // The story arrives as raw streamed text — first line is the title, the rest
  // the body. Derive both for rendering (works while streaming and when done).
  const rawNl = story.indexOf("\n");
  const renderTitle = rawNl === -1 ? "" : story.slice(0, rawNl).trim();
  const renderBodyParas = (rawNl === -1 ? story : story.slice(rawNl)).trim().split(/\n\s*\n/);

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <a href="/dashboard" className="mb-6 inline-block text-[13px] font-semibold text-gold hover:underline">
          &larr; Back to dashboard
        </a>

        {/* Profile card */}
        <section className="mb-6 rounded-3xl warm-card p-8">
          <a href="/dashboard" className="mb-6 flex items-center gap-2.5">
            <Mark size={28} ring="#D28E28" pine="#2A3422" accent="#D28E28" />
            <span className="wordmark text-[18px] font-semibold text-ink">Lullawood</span>
            <span className="ml-auto eyebrow-caps text-[11px] text-gold-text">A new story every night</span>
          </a>
          <div className="mb-4 flex items-baseline justify-between">
            <h1 className="h-display text-3xl font-semibold text-ink">{child.name}</h1>
            <span className="text-[14px] text-ink-muted">
              {child.age != null ? `age ${child.age}` : "age not set"}
            </span>
          </div>

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {chips.map((c, i) => (
                <span key={i} className="rounded-full border border-border bg-cream-paper/60 px-3 py-1 text-[13px] text-ink">
                  {c}
                </span>
              ))}
            </div>
          )}

          {child.aboutText && (
            <p className="text-[14px] leading-relaxed text-ink-muted">{child.aboutText}</p>
          )}

          {child.avoidList && child.avoidList.length > 0 && (
            <p className="mt-4 text-[13px] text-ink-muted">
              <span className="font-bold">Never includes:</span> {child.avoidList.join(", ")}
            </p>
          )}
        </section>

        {/* Tonight's story */}
        <section className="night-panel rounded-3xl p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="h-display text-xl font-semibold text-cream-paper">Tonight&apos;s story</h2>
            <button onClick={writeStory} disabled={generating}
              className="shrink-0 rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-5 py-2.5 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_22px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-70">
              {generating ? "Writing…" : story ? "Write another" : waitingStory ? "Write a different one" : "Write tonight's story"}
            </button>
          </div>

          <div className="mb-5">
            <textarea
              value={tonight}
              onChange={(e) => setTonight(e.target.value)}
              disabled={generating}
              rows={2}
              maxLength={500}
              placeholder={`Anything special for tonight? e.g. ${child.name} and a sibling on an adventure together`}
              className="w-full resize-none rounded-2xl border border-[#2f4a44] bg-[#1b2e28] px-4 py-3 text-[14px] text-cream-paper placeholder:text-cream-paper/40 outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
            />
            <p className="mt-1.5 text-[12px] text-cream-paper/50">Optional. Leave blank for a story from {child.name}&apos;s saved profile.</p>
          </div>

          {genError && <p className="mb-3 text-[14px] font-semibold text-[#f0b8a8]">{genError}</p>}

          {/* Waiting nightly story — ready and waiting, no generation needed */}
          {waitingStory && !story && !generating && (
            <div className="rounded-2xl border border-gold/30 bg-[#1b2e28] p-5">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_0_4px_rgba(226,161,44,.18)]" />
                <span className="text-[14px] font-bold text-gold">Tonight&apos;s story is ready</span>
              </div>
              <p className="mb-4 text-[14px] leading-relaxed text-cream-paper/70">
                A fresh adventure for {child.name} is waiting for tonight.
              </p>
              <button onClick={readWaitingStory}
                className="rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-5 py-2.5 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_22px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5">
                Read tonight&apos;s story &rarr;
              </button>
            </div>
          )}

          {/* No story waiting yet — being prepared, with on-demand fallback */}
          {!waitingStory && !story && !generating && (
            <p className="text-[14px] leading-relaxed text-cream-paper/70">
              A fresh story for {child.name}, written for who they are tonight. It&apos;ll appear here.
              <br />
              <span className="text-cream-paper/50">Your story is being prepared — or generate one now.</span>
            </p>
          )}

          {generating && !streaming && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 h-2 w-2 rounded-full bg-gold animate-pulse-moon" />
              <p className="text-[14px] text-cream-paper/80">Writing a story just for {child.name}…</p>
            </div>
          )}

          {story && (
            <article className="animate-fade">
              {renderTitle && (
                <h3 className="h-display mb-4 text-center text-2xl font-semibold italic text-gold">{renderTitle}</h3>
              )}
              <div className="space-y-4 text-[16.5px] leading-[1.8] text-cream-paper">
                {renderBodyParas.map((para, idx) => (
                  <p key={idx} className="m-0">
                    {para}
                    {streaming && idx === renderBodyParas.length - 1 && (
                      <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse rounded bg-gold/80 align-middle" />
                    )}
                  </p>
                ))}
              </div>
            </article>
          )}
        </section>

        {/* Story history — the accumulating world, glimpsed. Full library is one tap away. */}
        {history.length > 0 && (
          <section className="mt-6 rounded-3xl warm-card p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="h-display text-xl font-semibold text-ink">Story history</h2>
              {historyTotal > history.length && (
                <a href={`/dashboard/children/${id}/stories`} className="shrink-0 text-[13px] font-bold text-gold-text hover:underline">
                  See all {historyTotal} stories &rarr;
                </a>
              )}
            </div>
            <ul className="space-y-3">
              {history.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/dashboard/children/${id}/stories/${s.id}`}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-lift transition hover:-translate-y-0.5 hover:border-gold/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-ink">{historyTitle(s)}</span>
                      <span className="text-[12px] text-ink-muted">
                        {relativeNight(s.createdAt)}{s.isNightly ? " · Nightly" : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-gold-text transition group-hover:gap-2.5">
                      Read again
                      <span aria-hidden>&rarr;</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {historyTotal > history.length && (
              <a href={`/dashboard/children/${id}/stories`} className="mt-4 inline-block text-[13px] font-bold text-gold-text hover:underline">
                See all {historyTotal} stories &rarr;
              </a>
            )}
          </section>
        )}
      </div>
    </main>
  );
}