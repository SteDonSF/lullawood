"use client";
export const runtime = "edge";
// =============================================================================
// /dashboard/children/[id]/stories  —  the child's story library
// -----------------------------------------------------------------------------
// WHAT: The accumulated world made visible — every adventure this child has had,
//   newest first, as a grid of cards. This is the retention surface: "47
//   adventures" is a switching cost you can see. Tap a card to re-read it.
// TALKS TO: GET /api/stories/[childId] (ownership-checked, paginated).
// SESSION: page is session-gated (redirect to /login); the API is session-scoped
//   too, so this is defence in depth.
// =============================================================================
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Mark } from "@/components/Mark";
import { relativeNight } from "@/lib/relative-date";

type Story = {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  createdAt: string;
  isNightly: boolean;
  coStarChildId: string | null;
  coStarName: string | null;
};

function titleOf(s: Story): string {
  if (s.title && s.title.trim()) return s.title.trim();
  // Fall back to the first line of the body.
  const first = s.body.split("\n").map((l) => l.trim()).find(Boolean);
  return first || "A Lullawood story";
}

export default function StoryLibraryPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { data: session, isPending } = useSession();

  const [childName, setChildName] = useState<string>("");
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!session || !id) return;
    fetch(`/api/stories/${id}?limit=100`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setChildName(d.childName ?? "");
        setStories(d.stories ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [session, id]);

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

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-paper px-4">
        <div className="text-center">
          <p className="mb-3 text-ink">We couldn&apos;t find that library.</p>
          <a href="/dashboard" className="font-bold text-gold hover:underline">Back to dashboard</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <a href={`/dashboard/children/${id}`} className="mb-6 inline-block text-[13px] font-semibold text-gold hover:underline">
          &larr; Back to {childName || "child"}
        </a>

        <section className="rounded-3xl warm-card p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <Mark size={26} ring="#D28E28" pine="#2A3422" accent="#D28E28" />
            <span className="wordmark text-[17px] font-semibold text-ink">Lullawood</span>
            <span className="ml-auto eyebrow-caps text-[11px] text-gold-text">
              {stories.length} {stories.length === 1 ? "adventure" : "adventures"}
            </span>
          </div>

          <h1 className="h-display mb-1 text-3xl font-semibold text-ink">
            {childName ? `${childName}'s stories` : "Story library"}
          </h1>
          <p className="mb-6 text-[14px] text-ink-muted">Every adventure, newest first. Tap one to read it again.</p>

          {stories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e0d4b8] bg-cream-paper/50 px-6 py-12 text-center">
              <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-ink-muted">
                {childName ? `${childName}'s` : "This"} story world is just beginning.
                Tonight&apos;s story will appear here.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {stories.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/dashboard/children/${id}/stories/${s.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-border bg-white p-5 shadow-lift transition hover:-translate-y-0.5 hover:border-gold/50"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.isNightly ? "bg-[#f3e7cf] text-gold-text" : "bg-cream-paper text-ink-muted"}`}>
                        {s.isNightly ? "Nightly" : "On request"}
                      </span>
                      <span className="text-[12px] text-ink-muted">{relativeNight(s.createdAt)}</span>
                    </div>
                    <h3 className="h-display mb-1 text-[17px] font-semibold text-ink">{titleOf(s)}</h3>
                    {s.coStarChildId && s.coStarName && (
                      <p className="mb-1.5 text-[12px] font-bold text-gold-text">&#10022; with {s.coStarName}</p>
                    )}
                    {s.summary && (
                      <p className="mb-3 line-clamp-2 text-[13.5px] leading-relaxed text-ink-muted">{s.summary}</p>
                    )}
                    <span className="mt-auto flex items-center gap-1.5 text-[13px] font-bold text-gold-text transition group-hover:gap-2.5">
                      Read again
                      <span aria-hidden>&rarr;</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
