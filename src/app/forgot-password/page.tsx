"use client";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleRequest() {
    setLoading(true);
    await requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-paper px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-lift">
        {sent ? (
          <>
            <h1 className="h-display mb-1 text-2xl font-semibold text-ink">Check your inbox</h1>
            <p className="mb-6 text-[14px] text-ink-muted">
              If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in one hour.
            </p>
            <a href="/login" className="font-bold text-gold hover:underline text-[14px]">Back to log in</a>
          </>
        ) : (
          <>
            <h1 className="h-display mb-1 text-2xl font-semibold text-ink">Reset your password</h1>
            <p className="mb-6 text-[14px] text-ink-muted">
              Enter your email and we&apos;ll send you a link to set a new one.
            </p>

            <label className="mb-1 block text-[13px] font-bold text-ink-muted">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRequest()}
              className="mb-5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />

            <button onClick={handleRequest} disabled={loading || !email.trim()}
              className="w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-70">
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <p className="mt-5 text-center text-[14px] text-ink-muted">
              Remembered it? <a href="/login" className="font-bold text-gold hover:underline">Back to log in</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
