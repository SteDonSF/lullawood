import type { MetadataRoute } from "next";

// next-on-pages requires the edge runtime for all routes, metadata routes included.
export const runtime = "edge";

// =============================================================================
// /robots.txt  —  Allow crawling of public pages; keep bots out of gated areas.
// -----------------------------------------------------------------------------
// /dashboard and /admin are private/authenticated surfaces and should never be
// indexed. The sitemap points crawlers at the pages we do want indexed.
// =============================================================================
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin"],
    },
    sitemap: "https://lullawood.com/sitemap.xml",
  };
}
