// =============================================================================
// /api/cron/trial-reminder  —  emails parents ~48h before their trial ends.
// -----------------------------------------------------------------------------
// WHAT: finds trialing subscriptions whose trial_end lands in the next 48h and
//   that haven't been reminded yet, sends the trial-ending email to each, and
//   marks trial_reminder_sent = true so nobody is emailed twice.
// TRIGGER: called on a schedule by a Cloudflare Cron Trigger (see the scheduled
//   Worker in DEPLOY/ROADMAP). Pages Functions can't hold a cron directly, so a
//   tiny scheduled Worker fetch()es this URL.
// SECURITY: not public. The caller must send  Authorization: Bearer <CRON_SECRET>
//   (CRON_SECRET is a Cloudflare env var). Any mismatch -> 401.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { user } from "@/lib/auth-schema";
import { sendTrialEndingEmail } from "@/lib/resend";
import { snapshotDailyMetrics } from "@/lib/metrics";

export const runtime = "edge";

const WINDOW_MS = 48 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });

  const provided = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() + WINDOW_MS);

  let scanned = 0;
  let sent = 0;
  let failed = 0;

  try {
    // Trialing subs whose trial ends within the next 48h and not yet reminded.
    const rows = await db
      .select({
        userId: schema.subscriptions.userId,
        trialEnd: schema.subscriptions.trialEnd,
      })
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.status, "trialing"),
          eq(schema.subscriptions.trialReminderSent, false),
          gte(schema.subscriptions.trialEnd, now),
          lte(schema.subscriptions.trialEnd, cutoff)
        )
      );

    scanned = rows.length;

    for (const row of rows) {
      const [u] = await db
        .select({ email: user.email, name: user.name })
        .from(user)
        .where(eq(user.id, row.userId))
        .limit(1);
      if (!u?.email) continue;

      const firstName = (u.name || "").trim().split(/\s+/)[0] || "there";
      const trialEndDate = row.trialEnd
        ? new Date(row.trialEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : "soon";

      const res = await sendTrialEndingEmail(u.email, firstName, trialEndDate);
      if (res.success) {
        // Mark reminded only on a confirmed send, so a failure retries next run.
        await db
          .update(schema.subscriptions)
          .set({ trialReminderSent: true, updatedAt: new Date() })
          .where(eq(schema.subscriptions.userId, row.userId));
        sent += 1;
      } else {
        failed += 1;
      }
    }

    // Piggyback the daily metrics snapshot on this run. It is the only cron we
    // already have at daily cadence, and the admin dashboard's 7-day averages
    // are only "measured" rather than "reconstructed" once seven of these
    // exist. Deliberately AFTER the emails and deliberately unable to fail
    // them: snapshotDailyMetrics() swallows its own errors and returns a bool.
    const snapshot = await snapshotDailyMetrics();

    return NextResponse.json({ ok: true, scanned, sent, failed, snapshot });
  } catch (err) {
    return NextResponse.json(
      { error: "cron_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
