"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";

type Child = {
  id: string;
  name: string;
  age: number | null;
};

type Sub = {
  hasAccess: boolean;
  plan: string | null;
  status: string | null;
  trialEnd?: string | null;
  cancelAtPeriodEnd?: boolean | null;
};

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const [children, setChildren] = useState<Child[]>([]);
  const [loadingKids, setLoadingKids] = useState(true);
  const [sub, setSub] = useState<Sub | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const loadSub = () =>
    fetch("/api/subscription").then((r) => r.json()).then((d) => setSub(d)).catch(() => setSub(null));

  useEffect(() => {
    if (!session) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setChildren(d.children ?? []))
      .catch(() => setChildren([]))
      .finally(() => setLoadingKids(false));
    loadSub();
  }, [session]);

  if (isPending) {
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

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const d = await res.json();
      if (d.url) window.location.href = d.url;
      else setPortalLoading(false);
    } catch {
      setPortalLoading(false);
    }
  }

  const planLabel = sub?.plan === "family" ? "Family" : sub?.plan === "dreamer" ? "Dreamer" : null;
  const statusLabel =
    sub?.status === "trialing" ? "Free trial" : sub?.status === "active" ? "Active" : sub?.status ?? "";
  const trialDate = sub?.trialEnd
    ? new Date(sub.trialEnd).toLocaleDateString(undefined, { month: "long", day: "numeric" })
    : null;

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="h-display text-3xl font-semibold text-ink">
              Goodnight, {firstName}.
            </h1>
            <p className="mt-1 text-[14px] text-ink-muted">Your family&apos;s Lullawood.</p>
          </div>
          <button
            onClick={() => signOut().then(() => (window.location.href = "/login"))}
            className="rounded-full border border-border bg-white px-5 py-2 text-[13px] font-bold text-ink-muted transition hover:border-[#d8c39a] hover:text-ink"
          >
            Log out
          </button>
        </header>

        <section className="mb-6 rounded-3xl border border-border bg-white p-6 shadow-lift">
          {sub?.hasAccess ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-semibold text-ink">
                  {planLabel} plan
                  <span className="ml-2 rounded-full bg-cream-paper px-2.5 py-0.5 text-[12px] font-bold text-ink-muted">
                    {statusLabel}
                  </span>
                </p>
                {sub.status === "trialing" && trialDate && (
                  <p className="mt-1 text-[13px] text-ink-muted">
                    Your free trial runs until {trialDate}.
                  </p>
                )}
                {sub.cancelAtPeriodEnd && (
                  <p className="mt-1 text-[13px] text-ink-muted">
                    Cancels at the end of the current period.
                  </p>
                )}
              </div>
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="shrink-0 rounded-full border border-border bg-white px-5 py-2.5 text-[13px] font-bold text-ink-muted transition hover:border-[#d8c39a] hover:text-ink disabled:opacity-60"
              >
                {portalLoading ? "Opening…" : "Manage subscription"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] font-semibold text-ink">No active plan</p>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    Start a free trial to write tonight&apos;s story.
                  </p>
                </div>

                <a
                  href="/pricing"
                  className="shrink-0 rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-5 py-2.5 text-[13px] font-bold text-[#3a2d05] shadow-[0_8px_22px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5"
                >
                  Choose a plan
                </a>
              </div>
              <ReviewerCodeField onRedeemed={loadSub} />
            </>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-white p-8 shadow-lift">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="h-display text-xl font-semibold text-ink">Your children</h2>
            <a
              href="/dashboard/children/new"
              className="rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-5 py-2.5 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_22px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5"
            >
              + Add a child
            </a>
          </div>

          {loadingKids ? (
            <p className="py-8 text-center text-[14px] text-ink-muted">Loading…</p>
          ) : children.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e0d4b8] bg-cream-paper/50 px-6 py-10 text-center">
              <p className="mb-1 text-[15px] font-semibold text-ink">No children yet.</p>
              <p className="mx-auto max-w-sm text-[14px] text-ink-muted">
                Let&apos;s add your first. Tell Lullawood who they are, and tonight&apos;s
                story will be written just for them.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {children.map((c) => (
                <li key={c.id}>
                  
                  <a
                    href={`/dashboard/children/${c.id}`}
                    className="flex items-center justify-between rounded-2xl border border-border bg-white px-5 py-4 transition hover:border-[#d8c39a]"
                  >
                    <span className="text-[16px] font-semibold text-ink">{c.name}</span>
                    <span className="text-[13px] text-ink-muted">
                      {c.age != null ? `age ${c.age}` : "age not set"}
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

function ReviewerCodeField({ onRedeemed }: { onRedeemed: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        setUnlocked(true);
        setTimeout(onRedeemed, 1400);
      } else {
        const errs: Record<string, string> = {
          invalid_code: "That code isn't valid.",
          code_expired: "That code has expired.",
          code_used_up: "That code has been fully used.",
          already_has_access: "You already have access.",
        };
        setErr(errs[data.error] ?? "Couldn't redeem that code.");
      }
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (unlocked) {
    return (
      <div className="mt-5 overflow-hidden rounded-2xl border border-[#e8d9b5] bg-gradient-to-b from-[#fdf6e6] to-[#f7ecd2] px-6 py-7 text-center motion-safe:animate-[lw-fade_.5s_ease-out]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] shadow-[0_8px_22px_rgba(226,161,44,.45)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3a2d05" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="h-display text-2xl font-semibold text-ink">You&apos;re in. ✨</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-ink-muted">
          Full Lullawood access — on us — for the next 60 days. Add your children below and
          tonight&apos;s story is ready to write.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-border pt-5">
      <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Have a reviewer code?</p>
      <div className="mt-2.5 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && redeem()}
          placeholder="LULLA-XXXXXX"
          className="flex-1 rounded-full border border-border bg-white px-4 py-2.5 text-[14px] font-mono tracking-wide text-ink placeholder:text-ink-muted/50 focus:border-[#d8c39a] focus:outline-none focus:ring-2 focus:ring-[rgba(226,161,44,.25)]"
        />
        <button
          onClick={redeem}
          disabled={busy}
          className="shrink-0 rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-2.5 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_22px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {busy ? "…" : "Redeem"}
        </button>
      </div>
      {err && <p className="mt-2 text-[13px] text-red-600">{err}</p>}
    </div>
  );
}