// =============================================================================
// src/lib/subscription.ts  —  "Is this parent allowed to use the product?"
// -----------------------------------------------------------------------------
// WHAT: One source of truth for access. A parent has access if their
//   subscription status is 'trialing' or 'active'. Everything else (canceled,
//   past_due, incomplete, or no row at all) = no access.
// USED BY: story generation gating, and the per-plan child cap.
//
// LULLAWOOD-FUTURE: when grace periods or dunning matter, 'past_due' might be
//   treated as still-has-access for a window. Keep that policy HERE so it's
//   consistent everywhere.
// =============================================================================
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { PLAN_LIMITS, type PlanId } from "@/lib/stripe";

const ACTIVE_STATUSES = new Set(["trialing", "active"]);

export type AccessInfo = {
  hasAccess: boolean;
  plan: PlanId | null;
  status: string | null;
  maxChildren: number;
};

export async function getAccess(userId: string): Promise<AccessInfo> {
  const db = getDb();
  let row:
    | { plan: string | null; status: string | null }
    | undefined;
  try {
    [row] = await db
      .select({ plan: schema.subscriptions.plan, status: schema.subscriptions.status })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);
  } catch {
    // If the lookup fails, fail CLOSED (no access) — safer for a paywall.
    return { hasAccess: false, plan: null, status: null, maxChildren: 0 };
  }

  const status = row?.status ?? null;
  const plan = (row?.plan as PlanId | undefined) ?? null;
  const hasAccess = status ? ACTIVE_STATUSES.has(status) : false;
  const maxChildren = plan && PLAN_LIMITS[plan] ? PLAN_LIMITS[plan].maxChildren : 0;

  return { hasAccess, plan, status, maxChildren };
}