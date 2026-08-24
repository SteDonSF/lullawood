// =============================================================================
// /api/cron/weekly-digest  —  the Monday morning email.
// -----------------------------------------------------------------------------
// WHAT: five lines — demos, signups, trials, actives, churn — plus the channel
//   table as plain text, so the state of the business arrives without anyone
//   opening a dashboard.
// TRIGGER: the lullawood-weekly-digest Worker (workers/digest), which owns the
//   cron and decides when it is actually 8am in Los Angeles.
// SECURITY: same pattern as the other cron routes — Authorization: Bearer
//   <CRON_SECRET>, 401 on any mismatch. Not behind Cloudflare Access, because
//   a Worker cannot pass an Access check; the shared secret is the wall.
// DRY RUN: ?dry=1 returns the rendered text WITHOUT sending, so you can check
//   the numbers without waiting for Monday. Still requires the secret.
// =============================================================================
import { NextRequest, NextResponse } from "next/server";
import { getWeekSummary, getWeekMoney, getChannels, usd, pct } from "@/lib/metrics";
import { sendWeeklyDigestEmail } from "@/lib/resend";

export const runtime = "edge";

/** Pad/truncate to a fixed width so the plain-text table lines up in monospace. */
function cell(s: string, w: number, right = false): string {
  const t = s.length > w ? s.slice(0, w - 1) + "…" : s;
  return right ? t.padStart(w) : t.padEnd(w);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  const provided = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const to = process.env.DIGEST_TO || "stephenpdonnelly@gmail.com";
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  try {
    const [week, money, channels] = await Promise.all([
      getWeekSummary(),
      getWeekMoney(),
      getChannels(),
    ]);

    // ---- the five lines ----
    const lines = [
      `Demos      ${week.demos}`,
      `Signups    ${week.signups}`,
      `Trials     ${week.trials}`,
      `Actives    ${week.actives}`,
      `Churn      ${week.churn}`,
    ];

    // ---- the money block ----
    // Same discipline as the dashboard: a number we cannot see gets a NAMED
    // REASON, never $0.00. Reading "$0.00" as "nothing churned" when it really
    // means "no billing period has ended yet" is the exact mistake this
    // formatting exists to prevent.
    const LW = 24; // label column width
    const moneyLine = (label: string, value: string) => label.padEnd(LW) + value;

    const moneyBlock = [
      "MONEY",
      moneyLine("MRR", usd(money.mrrCents)),
      moneyLine(
        "Revenue collected (7d)",
        money.collectedCents === null
          ? `— Stripe unavailable: ${money.collectedError ?? "unknown error"}`
          : `${money.collectedTruncated ? "≥ " : ""}${usd(money.collectedCents)}`
      ),
      moneyLine(
        "Ad spend (7d, est.)",
        money.adSpendCents === null
          ? "— no spend recorded for this period"
          : usd(money.adSpendCents)
      ),
      moneyLine(
        "Net (7d, ads only)",
        money.netCents === null
          ? "— needs revenue, see above"
          : usd(money.netCents)
      ),
      moneyLine(
        "Churned MRR (7d)",
        !money.churnObservable
          ? "— no billing period has ended yet"
          : money.churnedMrrCents > 0
          ? `-${usd(money.churnedMrrCents)}`
          : usd(0)
      ),
      "",
      // Two things that must never be misread, stated in the email itself
      // rather than left to memory.
      "NET IS NOT PROFIT. It is revenue minus ADVERTISING only. It excludes",
      "Anthropic API costs, Stripe fees, hosting, and everything else in the",
      "Venture Command base.",
      "",
      "Ad spend is pro-rated day by day from a manually entered MONTHLY figure,",
      money.adSpendMonths.length
        ? `so it is an estimate, not a charge. Months used: ${money.adSpendMonths.join(", ")}.`
        : "so it is an estimate, not a charge. No monthly figure has been entered yet.",
    ];

    // ---- the channel table, as plain text ----
    const W = { src: 14, n: 8, pctw: 9, money: 11 };
    const header =
      cell("SOURCE", W.src) + cell("SIGNUPS", W.n, true) + cell("TRIALS", W.n, true) +
      cell("PAYING", W.n, true) + cell("T→PAID", W.pctw, true) + cell("SPEND", W.money, true) +
      cell("CAC", W.money, true) + cell("M3 RET", W.pctw, true);
    const rule = "─".repeat(header.length);
    const body = channels.map((c) =>
      cell(c.source, W.src) +
      cell(String(c.signups), W.n, true) +
      cell(String(c.trials), W.n, true) +
      cell(String(c.paying), W.n, true) +
      cell(pct(c.trialToPaidPct, 0), W.pctw, true) +
      cell(c.spendCents ? usd(c.spendCents) : "—", W.money, true) +
      cell(c.cacCents === null ? "—" : usd(c.cacCents), W.money, true) +
      cell(c.month3Pct === null ? "—" : pct(c.month3Pct, 0), W.pctw, true)
    );

    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);
    const text = [
      `Lullawood — week ending ${stamp}`,
      "",
      ...lines,
      "",
      ...moneyBlock,
      "",
      "CHANNEL (lifetime)",
      header,
      rule,
      ...(body.length ? body : ["(no signups yet)"]),
      "",
      "Full dashboard: https://lullawood.com/admin/dashboard",
    ].join("\n");

    const subject = `Lullawood weekly — ${week.signups} signups, ${week.actives} active`;

    if (dry) return NextResponse.json({ ok: true, dry: true, subject, text });

    const sent = await sendWeeklyDigestEmail(to, subject, text);
    return NextResponse.json({ ok: sent.success, to, subject, error: sent.error });
  } catch (e) {
    return NextResponse.json(
      { error: "digest_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
