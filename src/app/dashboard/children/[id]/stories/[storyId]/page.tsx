"use client";
export const runtime = "edge";
// =============================================================================
// /dashboard/children/[id]/stories/[storyId]  —  read one saved story
// -----------------------------------------------------------------------------
// WHAT: Renders a single library story in the storybook reader (the same dark
//   "night window" look as tonight's story). Re-reading last week's adventure is
//   the emotional payoff of the accumulated world.
// SHARE: copies a plain-text version of the story to the clipboard — no public
//   URL is minted (a child's stories stay private); it's a "copy to share with
//   grandma" affordance, nothing more.
// SECURITY: session-gated; the API double-checks ownership (child + story).
// =============================================================================
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { relativeNight } from "@/lib/relative-date";

type Story = {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  createdAt: string;
  isNightly: boolean;
};

export default function StoryDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const storyId = String(params?.storyId ?? "");
  const { data: session, isPending } = useSession();

  const [childName, setChildName] = useState<string>("");
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session || !id || !storyId) return;
    fetch(`/api/stories/${id}/${storyId}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setChildName(d.childName ?? "");
        if (d.story) setStory(d.story);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [session, id, storyId]);

  async function share() {
    if (!story) return;
    const title = story.title?.trim() || "A Lullawood story";
    const text = `${title}\n\n${story.body.trim()}\n\n— A Lullawood bedtime story, written for ${childName || "our little one"}.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
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

  if (notFound || !story) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-paper px-4">
        <div className="text-center">
          <p className="mb-3 text-ink">We couldn&apos;t find that story.</p>
          <a href={`/dashboard/children/${id}/stories`} className="font-bold text-gold hover:underline">Back to the library</a>
        </div>
      </main>
    );
  }

  const title = story.title?.trim() || "A Lullawood story";
  const bodyParas = story.body.trim().split(/\n\s*\n/).filter(Boolean);

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <a href={`/dashboard/children/${id}/stories`} className="text-[13px] font-semibold text-gold hover:underline">
            &larr; Back to {childName ? `${childName}'s stories` : "the library"}
          </a>
          <button
            onClick={share}
            className="rounded-full border border-border bg-white px-4 py-2 text-[13px] font-bold text-ink-muted transition hover:border-gold/50 hover:text-ink"
          >
            {copied ? "Copied ✓" : "Share"}
          </button>
        </div>

        <section className="night-panel rounded-3xl p-8">
          <div className="mb-4 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${story.isNightly ? "bg-[#263a30] text-gold" : "bg-[#22332c] text-cream-paper/70"}`}>
              {story.isNightly ? "Nightly" : "On request"}
            </span>
            <span className="text-[12px] text-cream-paper/50">{relativeNight(story.createdAt)}</span>
          </div>

          <article className="animate-fade">
            <h1 className="h-display mb-5 text-center text-2xl font-semibold italic text-gold">{title}</h1>
            <div className="space-y-4 text-[16.5px] leading-[1.8] text-cream-paper">
              {bodyParas.map((para, i) => (
                <p key={i} className="m-0">{para}</p>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
