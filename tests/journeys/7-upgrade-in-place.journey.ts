// Journey 7 — "Upgrade to Family" changes the EXISTING subscription in place.
// -----------------------------------------------------------------------------
// GUARDS THE MONEY PATH. The old button POSTed /api/checkout, which is
// `mode: "subscription"` — a SECOND subscription on the same customer, with a
// second 7-day trial and the card collected again. This journey asserts the
// three things that made that a bug, straight from Stripe:
//   1. the customer still has exactly ONE live subscription (same id),
//   2. it now sits on the Family price for the same billing cadence,
//   3. its trial_end is unchanged — no new trial was started.
//
// MUTATES REAL BILLING, so it only runs when explicitly opted in with
// UX_AUDIT_ALLOW_BILLING_MUTATION=1, and it swaps the price back to Dreamer
// afterwards (proration_behavior=none) so the seeded account stays reusable.
// The revert emits customer.subscription.updated, whose metadata still carries
// userId, so the webhook returns our subscriptions row to 'dreamer' on its own.
// NOTE: on a trialing subscription neither the swap nor the revert prorates. On
// a paid period the swap writes proration lines to the next invoice (that is
// the intended `create_prorations` behavior) and the revert adds none.
// NON-DESTRUCTIVE otherwise: the form is left empty, so the auto-save after a
// successful switch does not fire and no child is created.
import type { Page } from "@playwright/test";
import { BASE_URL, AssertionError, SkipError, assert, login } from "./_shared";

export const name = "7 · Upgrade to Family switches the plan in place (one subscription, no new trial)";

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeGet(key: string, path: string): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json();
  if (!res.ok) throw new AssertionError(`Stripe GET ${path} failed: ${body?.error?.message ?? res.status}`);
  return body;
}

async function stripePost(key: string, path: string, form: Record<string, string>): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.json();
  if (!res.ok) throw new AssertionError(`Stripe POST ${path} failed: ${body?.error?.message ?? res.status}`);
  return body;
}

// Subscriptions that still cost the parent money (canceled/expired don't count).
const LIVE = new Set(["trialing", "active", "past_due", "unpaid", "incomplete"]);
const liveSubs = (subs: any[]) => subs.filter((s) => LIVE.has(s.status));

export async function run(page: Page) {
  const email = process.env.UX_AUDIT_DREAMER_EMAIL;
  const password = process.env.UX_AUDIT_DREAMER_PASSWORD;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const familyMonthly = process.env.STRIPE_PRICE_FAMILY_MONTHLY;
  const familyYearly = process.env.STRIPE_PRICE_FAMILY_YEARLY;

  // 1. Skip cleanly unless everything this needs is present AND opted in.
  if (!email || !password) {
    throw new SkipError("dreamer account not seeded (UX_AUDIT_DREAMER_EMAIL / UX_AUDIT_DREAMER_PASSWORD empty)");
  }
  if (!stripeKey) throw new SkipError("STRIPE_SECRET_KEY not set — can't verify the subscription in Stripe");
  if (process.env.UX_AUDIT_ALLOW_BILLING_MUTATION !== "1") {
    throw new SkipError("changes a real subscription — set UX_AUDIT_ALLOW_BILLING_MUTATION=1 to run");
  }

  // 2. Stripe state BEFORE: exactly one live subscription, on a Dreamer price.
  const customers = await stripeGet(stripeKey, `/customers?email=${encodeURIComponent(email)}&limit=10`);
  const customer = (customers.data ?? [])[0];
  if (!customer) throw new SkipError(`no Stripe customer for ${email.replace(/(.).*@/, "$1***@")}`);

  const before = liveSubs(
    (await stripeGet(stripeKey, `/subscriptions?customer=${customer.id}&status=all&limit=100`)).data ?? []
  );
  if (before.length !== 1) {
    throw new AssertionError(
      `precondition: expected exactly 1 live subscription before upgrading, found ${before.length}` +
        ` (${before.map((s: any) => `${s.id}:${s.status}`).join(", ")})`
    );
  }
  const originalSub = before[0];
  const originalItem = originalSub.items.data[0];
  const originalPrice: string = originalItem.price.id;
  const originalTrialEnd: number | null = originalSub.trial_end ?? null;
  const expectedFamilyPrice =
    originalItem.price.recurring?.interval === "year" ? familyYearly : familyMonthly;
  assert(expectedFamilyPrice, "STRIPE_PRICE_FAMILY_MONTHLY / _YEARLY must be set to verify the swap");

  try {
    // 3-4. Log in and open the add-child form. The Dreamer account is at its
    //      1-child cap, so the at-cap panel is up before anything is typed.
    await login(page, email, password);
    await page.goto(`${BASE_URL}/dashboard/children/new`, { waitUntil: "domcontentloaded" });

    const upgradeBtn = page.getByRole("button", { name: /upgrade to family/i });
    try {
      await upgradeBtn.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      throw new AssertionError("step 4: the at-cap panel with 'Upgrade to Family' should be up on mount");
    }

    // 5. Switch. Deliberately leaving the form empty so no child is created.
    await upgradeBtn.click();
    try {
      await page.getByText(/you're on the family plan/i).first().waitFor({ state: "visible", timeout: 20000 });
    } catch {
      throw new AssertionError("step 5: the in-place switch should confirm on the page, without leaving it");
    }

    // 6. It must NOT have gone to Stripe's hosted checkout.
    if (/checkout\.stripe\.com/.test(page.url())) {
      throw new AssertionError(`step 6: upgrading must not open hosted checkout (landed on ${page.url()})`);
    }

    // 7. The app now reports Family.
    const sub = await page.evaluate(async () => {
      const r = await fetch("/api/subscription");
      return r.ok ? await r.json() : null;
    });
    if (sub?.plan !== "family") {
      throw new AssertionError(`step 7: /api/subscription should report plan 'family', got '${sub?.plan}'`);
    }

    // 8. STRIPE IS THE TRUTH — still one subscription, same id, Family price,
    //    same trial. This is the assertion the old checkout flow would fail.
    const after = liveSubs(
      (await stripeGet(stripeKey, `/subscriptions?customer=${customer.id}&status=all&limit=100`)).data ?? []
    );
    if (after.length !== 1) {
      throw new AssertionError(
        `step 8: upgrading must leave exactly 1 live subscription, found ${after.length}` +
          ` (${after.map((s: any) => `${s.id}:${s.status}`).join(", ")}) — a second subscription means double billing`
      );
    }
    const now = after[0];
    if (now.id !== originalSub.id) {
      throw new AssertionError(`step 8: expected the SAME subscription ${originalSub.id}, found ${now.id}`);
    }
    if (now.items.data.length !== 1) {
      throw new AssertionError(
        `step 8: expected 1 subscription item, found ${now.items.data.length} — the swap added a price instead of replacing it`
      );
    }
    if (now.items.data[0].price.id !== expectedFamilyPrice) {
      throw new AssertionError(
        `step 8: expected the Family price ${expectedFamilyPrice}, found ${now.items.data[0].price.id}`
      );
    }
    if ((now.trial_end ?? null) !== originalTrialEnd) {
      throw new AssertionError(
        `step 8: trial_end changed (${originalTrialEnd} -> ${now.trial_end ?? null}) — the upgrade must not start a new trial`
      );
    }
  } finally {
    // 9. Put the seeded account back on Dreamer so this journey is repeatable.
    //    proration_behavior=none: the revert should not invoice anything.
    try {
      const current = await stripeGet(stripeKey, `/subscriptions/${originalSub.id}`);
      if (current.items.data[0]?.price?.id !== originalPrice) {
        await stripePost(stripeKey, `/subscriptions/${originalSub.id}`, {
          "items[0][id]": current.items.data[0].id,
          "items[0][price]": originalPrice,
          proration_behavior: "none",
          "metadata[plan]": "dreamer",
        });
      }
    } catch (e: any) {
      // Surfaced, never swallowed: a failed revert leaves a real account on Family.
      console.error(`  ! journey 7 could not revert ${originalSub.id} to ${originalPrice}: ${e?.message ?? e}`);
    }
  }
}
