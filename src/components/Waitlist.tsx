"use client";
import { useState } from "react";

export function Waitlist({ source = "home", dark = false }: { source?: string; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function join() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setState("error"); return; }
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  }

  if (state === "done") {
    return <p className={`text-[16px] font-bold ${dark ? "text-gold" : "text-gold-text"}`}>✦ You&apos;re on the list. We&apos;ll be in touch soon.</p>;
  }
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
      <input type="email" value={email} placeholder="you@email.com"
        onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
        onKeyDown={(e) => e.key === "Enter" && join()}
        className="flex-1 rounded-full border border-border bg-cream-paper px-5 py-3 text-[16px] font-semibold text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30" />
      <button onClick={join} disabled={state === "loading"}
        className="rounded-full bg-gradient-to-b from-gold to-[#c47e1e] px-7 py-3 text-[15px] font-bold text-[#2a2007] shadow-[0_10px_28px_rgba(210,142,40,.4)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70">
        {state === "loading" ? "Adding you…" : "Join the waitlist"}
      </button>
      {state === "error" && <p className="text-[13px] font-semibold text-peach sm:absolute sm:mt-14">Please enter a valid email and try again.</p>}
    </div>
  );
}
