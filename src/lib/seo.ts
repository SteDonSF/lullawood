// =============================================================================
// seo.ts  —  One place for the canonical site origin and all structured-data
// (JSON-LD) builders. Schema is generated from the same content.ts the pages
// render, so the markup and the visible copy never drift.
// =============================================================================
import { BRAND, FAQS, TIERS } from "@/lib/content";

export const SITE_URL = "https://lullawood.com";

// Absolute URL helper — keeps canonical/OG/JSON-LD links consistent.
export function abs(path = "/"): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

// Organization — brand identity for knowledge-panel eligibility.
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url: SITE_URL,
    logo: abs("/icon.png"),
    description:
      "Lullawood writes a personalized bedtime story for your child every night — starring their name, the animals and worlds they love, and characters who return night after night.",
    email: "hello@lullawood.com",
  };
}

// WebSite — associates the domain with the brand name in search.
// (No SearchAction: the site has no on-site search endpoint, so we don't claim one.)
export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: SITE_URL,
    description: BRAND.tagline,
  };
}

// Product + Offers — one product, one offer per plan/interval, from TIERS.
// Eligible for product/price rich results. No aggregateRating (we won't
// publish a rating count we can't stand behind).
export function productLd() {
  const offers = TIERS.flatMap((t) => [
    {
      "@type": "Offer",
      name: `${t.name} — Monthly`,
      price: t.price.toFixed(2),
      priceCurrency: "USD",
      url: abs("/pricing"),
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: `${t.name} — Annual`,
      price: t.yearly.replace(/[^0-9.]/g, ""),
      priceCurrency: "USD",
      url: abs("/pricing"),
      availability: "https://schema.org/InStock",
    },
  ]);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: BRAND.name,
    description:
      "A new personalized bedtime story for your child every night, written to be read aloud and wind them gently down to sleep. Every plan starts with a 7-day free trial.",
    brand: { "@type": "Brand", name: BRAND.name },
    url: abs("/pricing"),
    offers,
  };
}

// FAQPage — from the same FAQS the on-page accordion renders.
export function faqLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
