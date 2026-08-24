// =============================================================================
// analytics-server.ts — the one funnel event we fire from the server.
// -----------------------------------------------------------------------------
// WHY server-side: `subscription_active` marks money actually changing hands,
//   and Stripe is the only thing that knows it happened. Firing it from the
//   browser would mean trusting a redirect back from Stripe's domain — which a
//   parent can close, refresh, or never complete, and which anyone could hit
//   directly. The webhook is the truth, so the event comes from the webhook.
//
// CAVEAT worth knowing when you read the dashboard: an event posted from an
//   edge worker has no real visitor behind it — no cookie, no referrer, no
//   session. Plausible therefore counts it as its own visitor and CANNOT
//   attribute it to the ad that started the journey. The `source` prop below
//   carries the channel across that gap: break down on it rather than on
//   Plausible's own acquisition report for this event.
// =============================================================================
import type { FunnelEvent, EventProps } from "./analytics";

const PLAUSIBLE_ENDPOINT = "https://plausible.io/api/event";

/** The site as registered in Plausible. */
const DOMAIN = process.env.PLAUSIBLE_DOMAIN ?? "lullawood.com";

/**
 * POST one event to Plausible's Events API. Best-effort by design: resolves
 * false on any failure and never throws, so a Plausible outage can never make
 * Stripe retry a webhook we already handled correctly.
 */
export async function trackServer(
  event: FunnelEvent,
  props?: EventProps,
  url = `https://${DOMAIN}/api/stripe/webhook`
): Promise<boolean> {
  try {
    const res = await fetch(PLAUSIBLE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Plausible requires a User-Agent and drops requests without one.
        // Naming ourselves keeps these honest in the logs rather than
        // impersonating a browser.
        "User-Agent": "Lullawood-Server/1.0 (+https://lullawood.com)",
      },
      body: JSON.stringify({
        name: event,
        url,
        domain: DOMAIN,
        props: props ?? {},
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
