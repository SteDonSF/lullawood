// =============================================================================
// analytics.ts — Plausible funnel events (browser side).
// -----------------------------------------------------------------------------
// WHAT: One safe wrapper around window.plausible so call sites stay one-liners
//   and no page can ever break because analytics didn't load.
//
// WHY it can't just call window.plausible directly: the script is injected with
//   strategy="afterInteractive", so there is a window in which it hasn't landed
//   yet — plus ad blockers remove it outright for a meaningful slice of
//   visitors. The init stub in the root layout queues early calls into
//   plausible.q, and the guards below cover the rest. An analytics miss must
//   never surface as a broken demo or a failed signup.
//
// Server-rendered? No-ops. See analytics-server.ts for the one event that is
// deliberately fired from the server instead (subscription_active).
// =============================================================================

/** The funnel, start to finish. A closed union so a typo is a build error. */
export type FunnelEvent =
  | "demo_started"
  | "demo_completed"
  | "signup_started"
  | "signup_completed"
  | "child_added"
  | "checkout_started"
  | "subscription_active";

export type EventProps = Record<string, string | number>;

declare global {
  interface Window {
    plausible?: {
      (event: string, options?: { props?: EventProps }): void;
      q?: unknown[];
    };
  }
}

/**
 * Record a funnel event. Silent no-op server-side, before the script loads
 * (calls are queued by the init stub), or when Plausible is blocked entirely.
 */
export function track(event: FunnelEvent, props?: EventProps): void {
  if (typeof window === "undefined") return; // SSR / edge render
  const plausible = window.plausible;
  if (typeof plausible !== "function") return; // not loaded, or blocked
  try {
    plausible(event, props && Object.keys(props).length > 0 ? { props } : undefined);
  } catch {
    /* analytics must never throw into a user flow */
  }
}
