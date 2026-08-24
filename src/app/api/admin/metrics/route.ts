// =============================================================================
// /api/admin/metrics  —  everything the admin dashboard renders.
// -----------------------------------------------------------------------------
// SECURITY: gated by requireAccess() (src/lib/access.ts) on EVERY request.
//   This route previously had no auth check at all and was reachable
//   unauthenticated on lullawood.pages.dev, where it served subscriber emails.
//   See the header of access.ts for the full finding and the two-layer fix.
// =============================================================================
import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/access";
import { getHealth, getChannels, getCohorts, getProductHealth, getRevenue } from "@/lib/metrics";
import { fetchFunnel } from "@/lib/plausible";

export const runtime = "edge";

export async function GET(req: Request) {
  const gate = await requireAccess(req);
  if (!gate.ok) return NextResponse.json({ error: "forbidden", reason: gate.reason }, { status: gate.status });

  try {
    // Independent queries — run them together rather than serially.
    const [health, revenue, channels, cohorts, product, f7, f30, f90] = await Promise.all([
      getHealth(),
      getRevenue(),
      getChannels(),
      getCohorts(),
      getProductHealth(),
      fetchFunnel("7d"),
      fetchFunnel("30d"),
      fetchFunnel("90d"),
    ]);

    return NextResponse.json({
      health,
      revenue,
      channels,
      cohorts,
      product,
      funnel: { "7d": f7, "30d": f30, "90d": f90 },
      viewer: gate.identity.email,
      // Surfaced in the UI footer so it's obvious whether the assertion was
      // cryptographically checked or merely present behind the host allowlist.
      accessVerified: gate.identity.verified,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "metrics_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
