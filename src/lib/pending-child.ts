// =============================================================================
// src/lib/pending-child.ts  —  The child a parent typed but couldn't save yet.
// -----------------------------------------------------------------------------
// WHY: a Dreamer at their 1-child cap fills in the whole add-child form and the
//   POST /api/profile is refused (402 no plan / 403 child_limit — correctly,
//   the server cap fails closed). Whatever they typed has to survive the trip
//   through Stripe checkout, which returns them to /dashboard?welcome=1, a
//   different page entirely.
// WHAT: the exact POST payload is parked under one key, so the form can prefill
//   itself on the way back and the dashboard can offer a "Finish adding {name}"
//   thread back to it.
// WHO: written + cleared by /dashboard/children/new, read by /dashboard.
// STORAGE: localStorage, NOT sessionStorage — Stripe checkout can open in a new
//   tab, and a per-tab draft would be invisible exactly when it's needed most.
//   The trade-off is that it outlives the tab, so every read enforces a 24-hour
//   expiry: a draft older than one upgrade sitting is stale, not a saved form.
// =============================================================================

export const PENDING_CHILD_KEY = "lullawood:pendingChild";

/** A parked draft is only ever meant to survive one upgrade round trip. */
export const PENDING_CHILD_TTL_MS = 24 * 60 * 60 * 1000;

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

// What actually sits in storage: the payload plus when it was parked.
type StoredPendingChild = PendingChild & { savedAt: number };

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// Anything unparseable (hand-edited storage, an older shape) or expired reads as
// "nothing pending" rather than throwing into a render.
export function readPendingChild(): PendingChild | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_CHILD_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<StoredPendingChild> | null;
    if (!d || typeof d !== "object") return null;

    // No savedAt (a pre-expiry draft) counts as stale — we can't tell its age.
    const savedAt = typeof d.savedAt === "number" ? d.savedAt : 0;
    if (Date.now() - savedAt > PENDING_CHILD_TTL_MS) {
      clearPendingChild();
      return null;
    }

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
    const stored: StoredPendingChild = { ...child, savedAt: Date.now() };
    window.localStorage.setItem(PENDING_CHILD_KEY, JSON.stringify(stored));
  } catch {
    // Private mode / quota — losing the draft is bad but must never block the
    // parent's way forward (the /pricing bounce or the checkout redirect).
  }
}

export function clearPendingChild(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_CHILD_KEY);
  } catch {
    /* nothing to do — an unreadable store is already "no pending child" */
  }
}
