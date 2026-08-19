// =============================================================================
// src/lib/pending-child.ts  —  The child a parent typed but couldn't save yet.
// -----------------------------------------------------------------------------
// WHY: a Dreamer at their 1-child cap fills in the whole add-child form, the
//   POST /api/profile is refused (402 no plan / 403 child_limit — correctly,
//   the server cap fails closed), and we bounce them to /pricing. Stripe then
//   drops them back on /dashboard?welcome=1, a different page entirely, so
//   everything they typed used to be gone and they had to retype it.
// WHAT: the exact POST payload is parked in sessionStorage under one key, so
//   the form can prefill itself on the way back and the dashboard can offer a
//   "Finish adding {name}" thread back to it.
// WHO: written + cleared by /dashboard/children/new, read by /dashboard.
// sessionStorage (not localStorage) on purpose: this is a single upgrade round
//   trip in one tab, not a draft that should outlive the browser session.
// =============================================================================

export const PENDING_CHILD_KEY = "lullawood:pendingChild";

// Exactly the body /api/profile POST expects (age as the raw form string; the
// server clamps + parses it). Storing the payload verbatim keeps write/read
// symmetrical — no lossy re-derivation on the way back into the form.
export type PendingChild = {
  name: string;
  age: string;
  animals: string[];
  interests: string;
  aboutText: string;
  avoidList: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// Anything unparseable (hand-edited storage, an older shape) reads as "nothing
// pending" rather than throwing into a render.
export function readPendingChild(): PendingChild | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_CHILD_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<PendingChild> | null;
    if (!d || typeof d !== "object") return null;
    return {
      name: str(d.name),
      age: str(d.age),
      animals: Array.isArray(d.animals) ? d.animals.map((a) => str(a)).filter(Boolean) : [],
      interests: str(d.interests),
      aboutText: str(d.aboutText),
      avoidList: str(d.avoidList),
    };
  } catch {
    return null;
  }
}

export function writePendingChild(child: PendingChild): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_CHILD_KEY, JSON.stringify(child));
  } catch {
    // Private mode / quota — losing the draft is bad but must never block the
    // redirect to /pricing, which is the parent's way forward.
  }
}

export function clearPendingChild(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_CHILD_KEY);
  } catch {
    /* nothing to do — an unreadable store is already "no pending child" */
  }
}
