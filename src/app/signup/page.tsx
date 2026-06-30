"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Mark } from "@/components/Mark";

function SignupForm() {
  const params = useSearchParams();
  const childName = (params.get("name") ?? "").trim();
  const childAge = (params.get("age") ?? "").trim();
  const childAnimal = (params.get("animal") ?? "").trim();

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
      const raw = error.message || "";
      const friendly = /email/i.test(raw)
        ? "Please enter a valid email address."
        : /password/i.test(raw)
        ? "Your password needs at least 8 characters."
        : /exist|already/i.test(raw)
        ? "An account with this email already exists. Try logging in."
        : "Something went wrong. Please try again.";
      setError(friendly);
      return;
    }
    if (childName) {
      const qs = new URLSearchParams({ name: childName });
      if (childAge) qs.set("age", childAge);
      if (childAnimal) qs.set("animal", childAnimal);
      window.location.href = `/dashboard/children/new?${qs.toString()}`;
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-paper px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-lift">
        <a href="/" aria-label="Back to Lullawood" className="mb-6 flex flex-col items-center gap-2.5">
          <Mark size={64} />
          <span className="wordmark text-[28px] font-semibold text-ink">Lullawood</span>
        </a>
        <h1 className="h-display mb-1 text-center text-2xl font-semibold text-ink">Create your account</h1>
        <p className="mb-2 text-center text-[14px] text-ink-muted">
          {childName ? `Let's set up ${childName}'s Lullawood.` : "Start your family's Lullawood."}
        </p>
        <p className="mb-6 text-center text-[12.5px] text-ink-muted/80">
          7-night free trial · No charge today · Cancel anytime
        </p>

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

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}