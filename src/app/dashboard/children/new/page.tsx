"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mark } from "@/components/Mark";
import {
  clearPendingChild,
  readPendingChild,
  writePendingChild,
  type PendingChild,
} from "@/lib/pending-child";

// Mirrors PLAN_LIMITS in src/lib/stripe.ts. Kept as a local literal on purpose:
// importing that module into a client component would pull the Stripe SDK into
// the browser bundle. The server cap in /api/profile stays the authority — this
// is only how we warn the parent BEFORE they type a whole form for nothing.
const PLAN_CHILD_CAP: Record<string, number> = { dreamer: 1, family: 4 };

// One notice, two sources: the mount-time check (count >= cap) and a refused
// save (403 child_limit), which fills in the server's own wording.
type CapState = { plan: string | null; cap: number | null; message?: string };

function NewChildForm() {
  const params = useSearchParams();
  const seedName = (params.get("name") ?? "").trim();
  const seedAge = (params.get("age") ?? "").trim();
  const seedAnimal = (params.get("animal") ?? "").trim();

  const [name, setName] = useState(seedName);
  const [age, setAge] = useState(seedAge);
  const [animal, setAnimal] = useState(seedAnimal);
  const [interests, setInterests] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [avoid, setAvoid] = useState("");

  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // At-the-cap state, read on mount from the real child count + plan so the
  // notice is up BEFORE the parent types, not only after a refused save.
  const [capped, setCapped] = useState<CapState | null>(null);
  // True when this form was filled from a parked draft (the upgrade round trip).
  const [restored, setRestored] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  // True once the in-place switch to Family has gone through on this page.
  const [upgraded, setUpgraded] = useState(false);
  // How the mount-time cap check went. "failed" is NOT the same as "not at the
  // cap": a swallowed fetch error used to look exactly like a parent with room
  // to spare, which is how the at-cap notice went missing without a trace.
  const [planCheck, setPlanCheck] = useState<"pending" | "ok" | "failed" | "logged_out">("pending");
  // Bumped by the "Try again" link to re-run the check without remounting (a
  // remount would re-restore the draft over anything they have since typed).
  const [checkNonce, setCheckNonce] = useState(0);
  const noticeRef = useRef<HTMLDivElement>(null);

  // A refused save (the only thing that sets `message`) happens with the Save
  // button in view, well below the notice — bring the notice to them.
  useEffect(() => {
    if (capped?.message) noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [capped?.message]);

  // ---- On mount: restore whatever this parent already typed ----
  // A draft parked by an earlier refused save wins over the ?name= seeds — it
  // is what they actually typed. Runs once; re-running would overwrite edits.
  useEffect(() => {
    const pending = readPendingChild();
    if (!pending) return;
    setName(pending.name);
    setAge(pending.age);
    setAnimal(pending.animals[0] ?? "");
    setInterests(pending.interests);
    setAboutText(pending.aboutText);
    setAvoid(pending.avoidList);
    // Don't hide restored answers behind the collapsed "+ More" section.
    if (pending.aboutText.trim() || pending.avoidList.trim()) setMoreOpen(true);
    setRestored(true);
  }, []);

  // ---- Where does this parent stand: child count + plan vs the cap? ----
  // Every failure mode reports itself. The server cap still fails closed on
  // save, but the parent should never fill a whole form on a silent maybe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [kidsRes, subRes] = await Promise.all([
        fetch("/api/profile").catch(() => null),
        fetch("/api/subscription").catch(() => null),
      ]);
      if (cancelled) return;
      if (kidsRes?.status === 401 || subRes?.status === 401) { setPlanCheck("logged_out"); return; }
      if (!kidsRes?.ok || !subRes?.ok) { setPlanCheck("failed"); return; }

      const kids = await kidsRes.json().catch(() => null);
      const sub = await subRes.json().catch(() => null);
      if (cancelled) return;

      const count = Array.isArray(kids?.children) ? kids.children.length : null;
      if (count === null) { setPlanCheck("failed"); return; }

      const plan = typeof sub?.plan === "string" ? sub.plan : null;
      const cap = plan ? PLAN_CHILD_CAP[plan] ?? null : null;
      // A plan name we don't recognise means we genuinely can't tell — say so.
      // No plan at all is a known state: the save 402s and sends them to /pricing.
      if (plan && cap === null) { setPlanCheck("failed"); return; }

      setPlanCheck("ok");
      if (cap !== null && count >= cap) setCapped({ plan, cap });
    })();
    return () => { cancelled = true; };
  }, [checkNonce]);

  // Swap the EXISTING subscription to Family in place (no second subscription,
  // no second trial, no card re-entry, no leaving this page). See
  // /api/subscription/upgrade for why this is not a checkout session.
  async function upgradeToFamily() {
    setError("");
    setUpgrading(true);
    try {
      const res = await fetch("/api/subscription/upgrade", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/login?next=/dashboard/children/new";
        return;
      }
      const d = await res.json().catch(() => ({}));

      if (res.ok) {
        setCapped(null);
        setUpgraded(true);
        setUpgrading(false);
        // They pressed Upgrade mid-save: finish what they were doing. The
        // route wrote plan=family to our row before responding, so the cap
        // check on this POST already sees Family.
        if (name.trim() && age.trim()) await handleSave();
        return;
      }

      // Nothing to switch — a reviewer grant, or a lapsed plan. Park what they
      // typed and let them pick a plan instead of showing them an error.
      if (d.action === "choose_plan") {
        writePendingChild(currentPayload());
        window.location.href = "/pricing";
        return;
      }

      setError(d.message || "Couldn't switch your plan. Please try again.");
      setUpgrading(false);
    } catch {
      setError("Couldn't switch your plan. Please try again.");
      setUpgrading(false);
    }
  }

  // The exact body we POST — and the exact thing we park when a save is refused.
  function currentPayload(): PendingChild {
    return {
      name: name.trim(),
      age: age.trim(),
      animals: animal.trim() ? [animal.trim()] : [],
      interests,
      aboutText: aboutText.trim(),
      avoidList: avoid,
    };
  }

  async function handleSave() {
    setError("");
    if (!name.trim()) { setError("Please enter your child's name."); return; }
    if (!age.trim()) { setError("Please enter your child's age."); return; }

    const payload = currentPayload();

    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    // No subscription at all -> /pricing to pick a plan. Park what they typed
    // first: the form is about to be unmounted and Stripe returns them to
    // /dashboard?welcome=1, not here.
    if (res.status === 402) {
      writePendingChild(payload);
      window.location.href = "/pricing";
      return;
    }
    // At the plan's child cap -> stay put and show the upgrade panel in place.
    // Still park the draft: the upgrade itself leaves this page for Stripe.
    if (res.status === 403) {
      const d = await res.json().catch(() => ({}));
      if (d.error === "child_limit") {
        writePendingChild(payload);
        const plan = typeof d.plan === "string" ? d.plan : null;
        setCapped({ plan, cap: plan ? PLAN_CHILD_CAP[plan] ?? null : null, message: d.message });
      } else {
        setError(d.message || d.error || "Something went wrong saving. Please try again.");
      }
      return;
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Something went wrong saving. Please try again.");
      return;
    }
    // Saved (201/200) — the draft has served its purpose; nothing left pending.
    clearPendingChild();
    const d = await res.json().catch(() => ({}));
    window.location.href = d.child?.id ? `/dashboard/children/${d.child.id}` : "/dashboard";
  }

  const labelCls = "mb-1 block text-[13px] font-bold text-ink-muted";
  const inputCls =
    "mb-5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";

  return (
    <main className="min-h-screen bg-cream-paper px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <a href="/dashboard" className="mb-6 inline-block text-[13px] font-semibold text-gold hover:underline">
          &larr; Back to dashboard
        </a>

        <div className="rounded-3xl warm-card p-8">
          <a href="/dashboard" aria-label="Back to dashboard" className="mb-4 flex flex-col items-center gap-2">
            <Mark size={40} />
            <span className="wordmark text-[20px] font-semibold text-ink">Lullawood</span>
          </a>
          <h1 className="h-display mb-1 text-center text-2xl font-semibold text-ink">
            {seedName ? `Tell us about ${seedName}` : "Add a child"}
          </h1>
          <p className="mb-6 text-center text-[14px] text-ink-muted">
            Just a name and age to start — everything else is optional, and makes tonight&apos;s story feel even more like it was written for them.
          </p>

          {/* At the cap: say so up front, keep the form usable underneath. */}
          {capped && (
            <div ref={noticeRef} className="mb-6 rounded-2xl border border-gold/50 bg-[#fffdf4] p-5" role="status">
              <p className="text-[14.5px] font-semibold text-ink">
                {capped.message
                  ? capped.message
                  : capped.plan === "dreamer"
                  ? "You've used the one child the Dreamer plan covers."
                  : capped.cap
                  ? `You've used all ${capped.cap} children your plan covers.`
                  : "You've reached your plan's child limit."}
              </p>
              <p className="mt-1.5 text-[13.5px] text-ink-muted">
                Dreamer covers 1 child. Family covers up to 4, with sibling co-star stories.{" "}
                {capped.message
                  ? "We've kept everything you typed — it will still be here after you upgrade."
                  : "Fill this in now if you like — we'll keep it while you upgrade."}
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                {capped.plan === "dreamer" && (
                  <button type="button" onClick={upgradeToFamily} disabled={upgrading}
                    className="rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-2.5 text-[14px] font-bold text-[#3a2d05] shadow-[0_8px_20px_rgba(226,161,44,.35)] transition hover:-translate-y-0.5 disabled:opacity-70">
                    {upgrading ? "Starting…" : "Upgrade to Family →"}
                  </button>
                )}
                <a href="/pricing" className="text-[13.5px] font-bold text-gold-text underline decoration-dotted underline-offset-4 hover:text-ink">
                  See all plans
                </a>
              </div>
              {capped.plan === "dreamer" && (
                <p className="mt-2.5 text-[12.5px] text-ink-muted">
                  Switches your current plan — same card, no new trial, and you stay right here.
                </p>
              )}
            </div>
          )}

          {/* The switch went through: no redirect happened, so say so here. */}
          {upgraded && (
            <div className="mb-6 rounded-2xl border border-gold/50 bg-[#fffdf4] p-5" role="status">
              <p className="text-[14.5px] font-semibold text-ink">You&apos;re on the Family plan.</p>
              <p className="mt-1.5 text-[13.5px] text-ink-muted">
                Up to 4 children, with sibling co-star stories. Nothing was charged today.
              </p>
            </div>
          )}

          {/* We couldn't tell where they stand — never silently pretend we could. */}
          {planCheck === "failed" && (
            <p className="mb-5 rounded-2xl border border-border bg-cream-paper/60 px-4 py-3 text-[13.5px] text-ink-muted" role="status">
              We couldn&apos;t check your plan just now, so we can&apos;t say whether you have room for
              another child. Fill this in and save — we&apos;ll tell you if there&apos;s a problem.{" "}
              <button type="button" onClick={() => { setPlanCheck("pending"); setCheckNonce((n) => n + 1); }}
                className="font-bold text-gold-text underline decoration-dotted underline-offset-4 hover:text-ink">
                Try again
              </button>
            </p>
          )}
          {planCheck === "logged_out" && (
            <p className="mb-5 rounded-2xl border border-border bg-cream-paper/60 px-4 py-3 text-[13.5px] text-ink-muted" role="status">
              You&apos;re not logged in, so we can&apos;t check your plan.{" "}
              <a href="/login?next=/dashboard/children/new" className="font-bold text-gold-text underline decoration-dotted underline-offset-4 hover:text-ink">
                Log in
              </a>{" "}
              to add a child — anything you type here is kept.
            </p>
          )}

          {/* Came back from /pricing (or Stripe) — reassure them nothing was lost. */}
          {restored && (
            <p className="mb-5 rounded-2xl border border-border bg-cream-paper/60 px-4 py-3 text-[13.5px] text-ink-muted" role="status">
              We kept everything you typed{name.trim() ? ` about ${name.trim()}` : ""} — check it over and save.
            </p>
          )}

          <label className={labelCls}>Their name <span className="text-gold" aria-hidden>*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls}
            placeholder="e.g. Arno" aria-required="true" />

          <label className={labelCls}>Their age <span className="text-gold" aria-hidden>*</span></label>
          <input value={age} onChange={(e) => setAge(e.target.value)} className={inputCls}
            type="number" min={0} max={18} placeholder="e.g. 8" aria-required="true" />

          <label className={labelCls}>Favourite animal or companion <span className="font-normal text-ink-muted">(optional)</span></label>
          <input value={animal} onChange={(e) => setAnimal(e.target.value)} className={inputCls}
            placeholder="e.g. fox" />

          <label className={labelCls}>Interests <span className="font-normal text-ink-muted">(optional · separate with commas)</span></label>
          <input value={interests} onChange={(e) => setInterests(e.target.value)} className={inputCls}
            placeholder="e.g. soccer, space, dinosaurs" />

          {!moreOpen && (
            <button type="button" onClick={() => setMoreOpen(true)}
              className="mb-5 block text-left text-[13px] font-bold text-gold underline decoration-dotted underline-offset-4 hover:text-ink">
              + More about {name.trim() || "your child"} <span className="font-normal text-ink-muted">(optional)</span>
            </button>
          )}
          {moreOpen && (<>
          <label className={labelCls}>Tell us about them <span className="font-normal text-ink-muted">(optional · in your own words)</span></label>
          <textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)}
            rows={5} maxLength={1200}
            className="mb-5 w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            placeholder="Their personality, favourite colour, siblings and how they get along, comfort toys, inside jokes, where you live — anything that makes them who they are." />

          <label className={labelCls}>Never include <span className="font-normal text-ink-muted">(optional · separate with commas)</span></label>
          <input value={avoid} onChange={(e) => setAvoid(e.target.value)} className={inputCls}
            placeholder="e.g. spiders, thunderstorms" />
          </>)}

          {error && <p className="mb-4 text-[14px] font-semibold text-[#c2553d]">{error}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full rounded-full bg-gradient-to-b from-gold to-[#e3ac3c] px-6 py-3 text-[15px] font-bold text-[#3a2d05] shadow-[0_10px_28px_rgba(226,161,44,.4)] transition hover:-translate-y-0.5 disabled:opacity-70">
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function NewChildPage() {
  return (
    <Suspense fallback={null}>
      <NewChildForm />
    </Suspense>
  );
}
