import type { MetadataRoute } from "next";

// next-on-pages requires the edge runtime for all routes, metadata routes included.
export const runtime = "edge";

// =============================================================================
// /sitemap.xml  —  Static list of public, indexable pages.
// -----------------------------------------------------------------------------
// Keep this in sync with the marketing/legal surface we want crawled. Gated
// areas (/dashboard, /admin) are intentionally excluded and also Disallowed in
// robots.ts.
// =============================================================================
// Bump when the public pages meaningfully change, so crawlers know to recrawl.
const LAST_MODIFIED = "2026-08-13";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://lullawood.com";
  const paths = [
    "/",
    "/try",
    "/how-it-works",
    "/pricing",
    "/safety",
    "/privacy",
    "/terms",
  ];

  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: LAST_MODIFIED,
  }));
}
