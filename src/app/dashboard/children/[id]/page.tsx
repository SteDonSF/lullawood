"use client";
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

type Child = {
  id: string;
  name: string;
  age: number | null;
  animals: string[] | null;
  interests: string[] | null;
  aboutText: string | null;
  avoidList: string[] | null;
};

export default function ChildViewPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { data: session, isPending } = useSession();

  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // story generation state
  const [generating, setGenerating] = useState(false);
  const [story, setStory] = useState<string>("");
  const [storyTitle, setStoryTitle] = useState<string>("");
  const [genError, setGenError] = useState("");

  useEffect(() => {
    if (!session || !id) return;
    fetch(`/api/profile/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d?.child) setChild(d.child); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [session, id]);

  async function writeStory() {
    setGenError("");
    setStory("");
    setStoryTitle("");
    setGenerating(true);
    // File 4 makes /api/generate-story accept a childId and build the prompt
    // from the saved profile. We send childId; the server does the rest.
    const res = await fetch("/api/generate-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: id }),
    });
    setGenerating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setGenError(d.error || "Couldn't write a story just now. Please try again.");
      return;
    }
    const d = await res.json();
    setStory(d.story ?? d.body ?? "");
    setStoryTitle(d.title ?? "");
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

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <a href="/dashboard" className="mb-6 inline-block text-[13px] font-semibold text-gold hover:underline">
          &larr; Back to dashboard
        </a>

        {/* Profile card */}
        <section className="mb-6 rounded-3xl border border-border bg-white p-8 shadow-lift">
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
        <section className="rounded-3xl border border-border bg-white p-8 shadow-lift">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="h-display text-xl font-semibold text-ink">Tonight&apos;s story</h2>
            <button onClick={writeStory} disabled={generating}
              className="rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-5 py-2.5 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_22px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-70">
              {generating ? "Writing…" : story ? "Write another" : "Write tonight's story"}
            </button>
          </div>

          {genError && <p className="mb-3 text-[14px] font-semibold text-[#c2553d]">{genError}</p>}

          {!story && !generating && (
            <p className="text-[14px] text-ink-muted">
              A fresh story for {child.name}, written for who they are tonight. It&apos;ll appear here.
            </p>
          )}

          {generating && (
            <p className="text-[14px] text-ink-muted">Writing a story just for {child.name}…</p>
          )}

          {story && (
            <article className="mt-2">
              {storyTitle && <h3 className="h-display mb-3 text-lg font-semibold text-ink">{storyTitle}</h3>}
              {/* plain prose, no markdown — preserve paragraph breaks */}
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{story}</div>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}