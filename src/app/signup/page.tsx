"use client";
import { useState } from "react";
import { signUp } from "@/lib/auth-client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup() {
    setLoading(true);
    setError("");
    const { error } = await signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: "/dashboard",
    });
    setLoading(false);
    if (error) {
      setError(error.message || "Something went wrong. Please try again.");
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-paper px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-lift">
        <h1 className="h-display mb-1 text-2xl font-semibold text-ink">Create your account</h1>
        <p className="mb-6 text-[14px] text-ink-muted">Start your family&apos;s Lullawood.</p>

        <label className="mb-1 block text-[13px] font-bold text-ink-muted">Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />

        <label className="mb-1 block text-[13px] font-bold text-ink-muted">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />

        <label className="mb-1 block text-[13px] font-bold text-ink-muted">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignup()}
          className="mb-2 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
        <p className="mb-5 text-[12px] text-ink-muted/80">At least 8 characters.</p>

        {error && <p className="mb-4 text-[14px] font-semibold text-[#c2553d]">{error}</p>}

        <button onClick={handleSignup} disabled={loading}
          className="w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-70">
          {loading ? "Creating your account…" : "Create account"}
        </button>

        <p className="mt-5 text-center text-[14px] text-ink-muted">
          Already have an account? <a href="/login" className="font-bold text-gold hover:underline">Log in</a>
        </p>
      </div>
    </main>
  );
}
