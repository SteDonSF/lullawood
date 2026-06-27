"use client";
import { useSession, signOut } from "@/lib/auth-client";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-paper">
        <p className="text-ink-muted">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-paper px-4">
        <div className="text-center">
          <p className="mb-4 text-ink">You&apos;re not logged in.</p>
          <a href="/login" className="font-bold text-gold hover:underline">Log in</a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream-paper px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-lift">
        <h1 className="h-display mb-2 text-2xl font-semibold text-ink">
          Welcome, {session.user.name}.
        </h1>
        <p className="mb-6 text-[14px] text-ink-muted">
          You&apos;re logged in as {session.user.email}. This is where your children&apos;s
          profiles and nightly stories will live.
        </p>
        <button
          onClick={() => signOut().then(() => (window.location.href = "/login"))}
          className="rounded-full border border-border bg-white px-6 py-2.5 text-[14px] font-bold text-ink-muted transition hover:border-[#d8c39a] hover:text-ink"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
