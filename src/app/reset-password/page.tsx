"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-client";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleReset() {
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Those passwords don't match."); return; }
    if (!token) { setError("This reset link is invalid or has expired. Please request a new one."); return; }

    setLoading(true);
    const { error } = await resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      setError(error.message || "This reset link is invalid or has expired. Please request a new one.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <>
        <h1 className="h-display mb-1 text-2xl font-semibold text-ink">Password updated</h1>
        <p className="mb-6 text-[14px] text-ink-muted">Your new password is set. You can log in with it now.</p>
        <a href="/login" className="inline-block w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-center text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5">
          Go to log in
        </a>
      </>
    );
  }

  return (
    <>
      <h1 className="h-display mb-1 text-2xl font-semibold text-ink">Choose a new password</h1>
      <p className="mb-6 text-[14px] text-ink-muted">Pick something at least 8 characters long.</p>

      <label className="mb-1 block text-[13px] font-bold text-ink-muted">New password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        className="mb-4 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />

      <label className="mb-1 block text-[13px] font-bold text-ink-muted">Confirm new password</label>
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleReset()}
        className="mb-5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />

      {error && <p className="mb-4 text-[14px] font-semibold text-[#c2553d]">{error}</p>}

      <button onClick={handleReset} disabled={loading}
        className="w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-70">
        {loading ? "Saving…" : "Set new password"}
      </button>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-paper px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-lift">
        <Suspense fallback={<p className="text-[14px] text-ink-muted">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
