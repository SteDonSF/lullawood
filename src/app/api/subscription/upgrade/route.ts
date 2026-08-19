// =============================================================================
// /api/subscription/upgrade  —  Move an existing subscription to Family, IN PLACE.
// -----------------------------------------------------------------------------
// WHY THIS EXISTS: the "Upgrade to Family" button used to POST /api/checkout,
//   which is `mode: "subscription"` — that ALWAYS creates a second subscription
//   object on the same customer, with a second 7-day trial, and asks for the
//   card again. The parent was then billed twice, and because the webhook's
//   upsert is keyed to userId (one row per parent, unique), whichever
//   subscription emitted the last event decided what the app believed.
// WHAT THIS DOES INSTEAD: one stripe.subscriptions.update() that swaps the
//   price on the EXISTING subscription item. No new subscription, no new trial,
//   no payment re-collection, no redirect off lullawood.com.
// PRORATION: 'create_prorations' — Stripe writes proration lines onto the next
//   invoice rather than charging now, so there is no SCA interstitial. A
//   subscription still in its trial simply keeps that trial and its end date.
// SECURITY: the parent comes from getSessionUser(). The subscription id is read
//   from OUR row for that user — never from the request body — and the
//   subscription Stripe hands back must belong to the customer we have on file.
// NOTE: we write plan/stripePriceId to our row BEFORE responding. The
//   customer.subscription.updated webhook will write the same values moments
//   later, but the parent's immediate retry of "save this child" reads
//   getAccess() -> our row, and would hit the 1-child cap again if we waited.
// UNTOUCHED: getAccess() and the /api/profile cap. This route only changes what
//   the parent is subscribed to; every access check still reads the same truth.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { getStripe, priceId, planFromPriceId, intervalFromPriceId } from "@/lib/stripe";

export const runtime = "edge";

const UPGRADEABLE_STATUSES = new Set(["trialing", "active"]);

const tsToDate = (unix: number | null | undefined): Date | null =>
  unix ? new Date(unix * 1000) : null;

// The UI turns these two into "go pick a plan on /pricing" instead of an error.
const noPlanToChange = (error: string, message: string) =>
  NextResponse.json({ error, message, action: "choose_plan" }, { status: 409 });

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const db = getDb();

  let row:
    | {
        plan: string | null;
        status: string | null;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
      }
    | undefined;
  try {
    [row] = await db
      .select({
        plan: schema.subscriptions.plan,
        status: schema.subscriptions.status,
        stripeCustomerId: schema.subscriptions.stripeCustomerId,
        stripeSubscriptionId: schema.subscriptions.stripeSubscriptionId,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, user.id))
      .limit(1);
  } catch {
    return NextResponse.json(
      { error: "lookup_failed", message: "We couldn't reach your plan just now. Please try again." },
      { status: 503 }
    );
  }

  // No Stripe subscription to change: a reviewer comp grant, or a parent who
  // never subscribed. Not an error — they just need to pick a plan.
  if (!row?.stripeSubscriptionId) {
    return noPlanToChange(
      "no_stripe_subscription",
      "There's no billing plan on this account to change yet."
    );
  }
  if (!row.status || !UPGRADEABLE_STATUSES.has(row.status)) {
    return noPlanToChange(
      "inactive_subscription",
      "Your plan isn't active, so there's nothing to switch."
    );
  }

  const stripe = getStripe();

  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  } catch {
    return NextResponse.json(
      { error: "stripe_error", message: "We couldn't reach Stripe just now. Please try again." },
      { status: 502 }
    );
  }

  // Defense in depth: the subscription we're about to edit must belong to the
  // customer we have on file for this parent.
  const subCustomer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!row.stripeCustomerId || subCustomer !== row.stripeCustomerId) {
    return NextResponse.json(
      { error: "customer_mismatch", message: "We couldn't verify this subscription." },
      { status: 409 }
    );
  }
  if (!UPGRADEABLE_STATUSES.has(sub.status)) {
    return noPlanToChange(
      "inactive_subscription",
      "Your plan isn't active, so there's nothing to switch."
    );
  }

  const item = sub.items.data[0];
  if (!item?.price?.id) {
    return NextResponse.json(
      { error: "no_subscription_item", message: "We couldn't read your current plan." },
      { status: 409 }
    );
  }

  const currentPlan = planFromPriceId(item.price.id);

  // Already on Family — idempotent no-op. Re-sync our row (it may be why the
  // caller thought an upgrade was needed) and report success without touching
  // Stripe, so a double-click can't do anything twice.
  if (currentPlan === "family") {
    try {
      await db
        .update(schema.subscriptions)
        .set({ plan: "family", stripePriceId: item.price.id, updatedAt: new Date() })
        .where(eq(schema.subscriptions.userId, user.id));
    } catch { /* the plan is right in Stripe; a row re-sync is best-effort */ }
    return NextResponse.json({ ok: true, plan: "family", changed: false });
  }
  if (currentPlan !== "dreamer") {
    return NextResponse.json(
      { error: "plan_not_upgradeable", message: "This plan can't be switched automatically." },
      { status: 409 }
    );
  }

  // Keep their billing cadence: a yearly Dreamer becomes a yearly Family.
  const interval = intervalFromPriceId(item.price.id) ?? "monthly";
  let targetPrice: string;
  try {
    targetPrice = priceId("family", interval);
  } catch {
    return NextResponse.json(
      { error: "price_not_configured", message: "The Family plan isn't available right now." },
      { status: 500 }
    );
  }

  let updated;
  try {
    updated = await stripe.subscriptions.update(row.stripeSubscriptionId, {
      // The ITEM id is what makes this a swap. Passing only `price` would ADD a
      // second item and bill Dreamer + Family on one subscription.
      items: [{ id: item.id, price: targetPrice }],
      proration_behavior: "create_prorations",
      // No trial fields: Stripe leaves an in-flight trial exactly as it is, and
      // a paid subscription never gains one. Never start a second trial here.
      // metadata is replaced wholesale, so carry userId (the webhook keys off
      // it) and correct the now-stale plan tag.
      metadata: { ...(sub.metadata ?? {}), userId: user.id, plan: "family" },
    });
  } catch {
    return NextResponse.json(
      { error: "stripe_error", message: "We couldn't switch your plan just now. Please try again." },
      { status: 502 }
    );
  }

  // Write our row before responding — see the header note about the retry race.
  const newPriceId = updated.items.data[0]?.price?.id ?? targetPrice;
  try {
    await db
      .update(schema.subscriptions)
      .set({
        plan: "family",
        stripePriceId: newPriceId,
        status: updated.status,
        currentPeriodEnd: tsToDate(updated.current_period_end),
        trialEnd: tsToDate(updated.trial_end),
        cancelAtPeriodEnd: updated.cancel_at_period_end ?? false,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.userId, user.id));
  } catch {
    // Stripe is the source of truth and the swap succeeded; the webhook will
    // reconcile our row. Say so rather than claiming the upgrade failed.
    return NextResponse.json(
      { ok: true, plan: "family", changed: true, synced: false, status: updated.status },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    plan: "family",
    changed: true,
    synced: true,
    status: updated.status,
  });
}
