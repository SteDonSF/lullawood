// =============================================================================
// attribution.ts — first-touch UTM attribution.
// -----------------------------------------------------------------------------
// WHAT: Remembers how a family FIRST arrived (utm_source / utm_campaign / the
//   page they landed on) so the eventual signup can be credited to that
//   channel — even though signup happens later, on a different page, and (on
//   the checkout path) after a round trip through Stripe's domain.
//
// WHY localStorage, not sessionStorage: the Stripe redirect is cross-origin and
//   sessionStorage is per-tab. A parent who tries the demo tonight and signs up
//   tomorrow morning must still be credited to the ad that brought them, so the
//   record needs to outlive both the tab and the redirect. An explicit 30-day
//   TTL keeps it from being forever.
//
// FIRST TOUCH ONLY: once a live record exists it is never overwritten. A later
//   ?utm_source= visit is ignored — the channel that made the introduction
//   keeps the credit.
//
// This module is imported from BOTH the browser and the edge runtime, so it
// must stay free of side effects and touch `window` only inside functions.
// =============================================================================

/** localStorage key. Namespaced so it is obvious whose it is in devtools. */
export const ATTR_KEY = "lw-attr";

/** How long a first touch stays valid. 30 days. */
export const ATTR_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type Attribution = {
  source: string;
  campaign: string | null;
  landing: string | null;
  /** Epoch ms of the first touch — the TTL anchor. */
  ts: number;
};

/**
 * Channels we knowingly buy, post, or partner on. The server refuses to write
 * anything outside this list verbatim (see `validateAttribution`), so a crafted
 * ?utm_source can never put arbitrary text into the user table.
 * Add a channel here BEFORE the campaign launches, or it lands as 'other'.
 */
export const KNOWN_SOURCES = [
  "google",
  "bing",
  "facebook",
  "instagram",
  "tiktok",
  "pinterest",
  "reddit",
  "youtube",
  "x",
  "twitter",
  "linkedin",
  "newsletter",
  "email",
  "podcast",
  "blog",
  "referral",
  "partner",
  "affiliate",
  "press",
] as const;

/** No utm_source at all — the visitor came straight to us. */
export const DIRECT_SOURCE = "direct";
/** A utm_source we do not recognise. Kept as a signal, not stored verbatim. */
export const OTHER_SOURCE = "other";

// --- sanitisers ------------------------------------------------------------
// Everything below runs on values that came off a URL, i.e. attacker-supplied.

/** Lowercased slug, safe charset, length-capped. Null when nothing is left. */
function safeToken(raw: unknown, max = 64): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .slice(0, max)
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || null;
}

/** A same-site path like "/try". Rejects absolute URLs, protocol-relative
 *  ("//evil.com") and anything with a query string or fragment. */
function safePath(raw: unknown, max = 128): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, max);
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  return /^\/[A-Za-z0-9\-._~/]*$/.test(s) ? s : null;
}

// --- browser API -----------------------------------------------------------

function clear(): void {
  try {
    window.localStorage.removeItem(ATTR_KEY);
  } catch {
    /* storage disabled — nothing to clear */
  }
}

/**
 * The stored first touch, or null when there is none / it is malformed / the
 * 30-day TTL has run out. Expired or unreadable records are cleared on read so
 * the next ?utm_source visit can start a fresh window.
 */
export function readAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(ATTR_KEY);
  } catch {
    return null; // private mode / storage blocked — attribution is optional
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clear();
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    clear();
    return null;
  }

  const o = parsed as Record<string, unknown>;
  const ts = typeof o.ts === "number" && Number.isFinite(o.ts) ? o.ts : null;
  const source = safeToken(o.source, 32);
  if (ts === null || source === null) {
    clear();
    return null;
  }
  if (Date.now() - ts > ATTR_TTL_MS) {
    clear();
    return null;
  }

  return { source, campaign: safeToken(o.campaign), landing: safePath(o.landing), ts };
}

/**
 * Call once per page load (mounted globally in the root layout, so it fires on
 * every entry point including /try).
 *
 * Stores {source, campaign, landing, ts} under "lw-attr" only when the URL
 * carries a utm_source AND nothing is already stored. Returns the live record
 * (existing or freshly written), or null when there is nothing to attribute.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;

  // FIRST TOUCH: an existing live record always wins, so check before parsing
  // the URL. A second campaign click never overwrites the first.
  const existing = readAttribution();
  if (existing) return existing;

  let source: string | null = null;
  let campaign: string | null = null;
  try {
    const params = new URLSearchParams(window.location.search);
    source = safeToken(params.get("utm_source"), 32);
    campaign = safeToken(params.get("utm_campaign"));
  } catch {
    return null;
  }
  if (!source) return null; // no utm_source — nothing to capture

  const record: Attribution = {
    source,
    campaign,
    // Path only: which page the ad pointed at. The query string is dropped so
    // no stray personal data rides along into storage or the database.
    landing: safePath(window.location.pathname),
    ts: Date.now(),
  };

  try {
    window.localStorage.setItem(ATTR_KEY, JSON.stringify(record));
  } catch {
    return null; // storage blocked — the signup will simply record 'direct'
  }
  return record;
}

/** Drop the stored first touch. Used by tests and by the TTL sweep above. */
export function clearAttribution(): void {
  if (typeof window === "undefined") return;
  clear();
}

// --- server-side validation -------------------------------------------------

/**
 * Turns whatever the browser POSTed into something safe to write to the user
 * row. Runs on the server: the payload is client-controlled and is treated as
 * such.
 *
 * - `source` is matched against KNOWN_SOURCES. Anything unrecognised becomes
 *   'other'; a missing source becomes 'direct'. The raw string is never stored.
 * - `campaign` and `landing` are charset- and length-limited, or dropped.
 */
export function validateAttribution(input: unknown): {
  source: string;
  campaign: string | null;
  landing: string | null;
} {
  const o = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const claimed = safeToken(o.source, 32);
  const source =
    claimed === null
      ? DIRECT_SOURCE
      : (KNOWN_SOURCES as readonly string[]).includes(claimed)
      ? claimed
      : OTHER_SOURCE;

  return { source, campaign: safeToken(o.campaign), landing: safePath(o.landing) };
}
