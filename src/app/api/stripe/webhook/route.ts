// =============================================================================
// /api/stripe/webhook  —  Stripe -> our DB. The source of truth for billing.
// -----------------------------------------------------------------------------
// WHAT: Stripe calls THIS endpoint when a subscription is created, renewed,
//   changes, or ends. We verify the signature, then upsert the subscriptions
//   row (keyed to userId) so the app's access checks read Stripe's truth.
// SECURITY: every event is signature-verified with STRIPE_WEBHOOK_SECRET.
//   EDGE NOTE: must use constructEventAsync (not constructEvent) — the sync
//   version uses Node crypto and fails on Cloudflare's edge runtime.
// userId recovery: we stashed { userId } in subscription_data.metadata at
//   checkout, so every subscription object carries it back to us.
//
// LULLAWOOD-FUTURE: on subscription end, you may want to email the parent
//   (win-back) — wire that here.
// LULLAWOOD-FUTURE: handle invoice.payment_failed for dunning/past_due UX.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { getStripe, planFromPriceId } from "@/lib/stripe";
import { getDb, schema } from "@/lib/db";
import { user } from "@/lib/auth-schema";
import {
  sendWelcomeEmail,
  sendPaymentFailedEmail,
  sendPaymentRecoveredEmail,
} from "@/lib/resend";
import { trackServer } from "@/lib/analytics-server";

export const runtime = "edge";

const DUNNING = new Set(["past_due", "unpaid"]);

// Look up the parent's email + first name for a userId. Returns null if absent.
async function lookupParent(
  db: ReturnType<typeof getDb>,
  userId: string
): Promise<{ email: string; firstName: string } | null> {
  const [u] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!u?.email) return null;
  const firstName = (u.name || "").trim().split(/\s+/)[0] || "there";
  return { email: u.email, firstName };
}

function tsToDate(unix: number | null | undefined): Date | null {
  return unix ? new Date(unix * 1000) : null;
}

// Write (insert or update) the subscription row for a given user.
async function upsert(
  db: ReturnType<typeof getDb>,
  userId: string,
  values: Partial<typeof schema.subscriptions.$inferInsert>
) {
  const [existing] = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(schema.subscriptions)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.subscriptions.userId, userId));
  } else {
    await db.insert(schema.subscriptions).values({
      userId,
      ...values,
    });
  }
}

// Map a Stripe Subscription object into our row shape.
function fromSubscription(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price?.id;
  const plan = priceId ? planFromPriceId(priceId) : null;
  return {
    plan: plan ?? undefined,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    status: sub.status,
    currentPeriodEnd: tsToDate(sub.current_period_end),
    trialEnd: tsToDate(sub.trial_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "no webhook secret" }, { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });

  const body = await req.text(); // raw body required for signature verification
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    // EDGE: async variant — uses Web Crypto, works on Cloudflare.
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const db = getDb();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          // Fetch the full subscription to record its state.
          const sub = await stripe.subscriptions.retrieve(
            typeof session.subscription === "string" ? session.subscription : session.subscription.id
          );
          await upsert(db, userId, {
            stripeCustomerId:
              typeof session.customer === "string" ? session.customer : session.customer?.id,
            ...fromSubscription(sub),
          });
          // Welcome email — best-effort, never fails the webhook.
          try {
            const parent = await lookupParent(db, userId);
            if (parent) await sendWelcomeEmail(parent.email, parent.firstName);
          } catch { /* email is non-critical */ }

          // Funnel: the bottom of it. Fired HERE and never from the browser —
          // the post-checkout redirect is skippable and forgeable, this is not.
          // The parent's first-touch channel rides along as a prop, because a
          // server-side event carries no session for Plausible to attribute.
          try {
            const [row] = await db
              .select({ source: user.signupSource })
              .from(user)
              .where(eq(user.id, userId))
              .limit(1);
            const priceId = sub.items.data[0]?.price?.id;
            await trackServer("subscription_active", {
              plan: (priceId ? planFromPriceId(priceId) : null) ?? "unknown",
              status: sub.status,
              source: row?.source ?? "unknown",
            });
          } catch { /* analytics is non-critical — never retry a good webhook */ }
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          // Capture the prior status BEFORE upsert to detect dunning transitions.
          const [prior] = await db
            .select({ status: schema.subscriptions.status })
            .from(schema.subscriptions)
            .where(eq(schema.subscriptions.userId, userId))
            .limit(1);
          const oldStatus = prior?.status ?? "";
          const newStatus = sub.status;
          await upsert(db, userId, {
            stripeCustomerId:
              typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
            ...fromSubscription(sub),
          });
          // Dunning emails — best-effort, on status transitions only.
          const enteredDunning = DUNNING.has(newStatus) && !DUNNING.has(oldStatus);
          const recovered = newStatus === "active" && DUNNING.has(oldStatus);
          if (enteredDunning || recovered) {
            try {
              const parent = await lookupParent(db, userId);
              if (parent) {
                if (enteredDunning) await sendPaymentFailedEmail(parent.email, parent.firstName);
                else await sendPaymentRecoveredEmail(parent.email, parent.firstName);
              }
            } catch { /* email is non-critical */ }
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await upsert(db, userId, {
            stripeCustomerId:
              typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
            ...fromSubscription(sub),
          });
        }
        break;
      }
      default:
        // Ignore other event types.
        break;
    }
  } catch {
    // Returning 500 makes Stripe retry — good for transient DB hiccups.
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}