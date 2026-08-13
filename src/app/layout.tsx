import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { organizationLd, websiteLd, SITE_URL } from "@/lib/seo";

// Self-hosted (latin-subset, variable) so the build never fetches from Google at
// build time. Files live in ./fonts. Weight ranges cover the weights we use.
const title = localFont({
  src: "./fonts/cinzel.woff2",
  weight: "500 700",
  variable: "--font-title",
  display: "swap",
});
const display = localFont({
  src: [
    { path: "./fonts/playfair.woff2", weight: "500 700", style: "normal" },
    { path: "./fonts/playfair-italic.woff2", weight: "500 700", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});
const body = localFont({
  src: "./fonts/nunito.woff2",
  weight: "400 800",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lullawood — A new bedtime story every night, where your child is the hero",
  description:
    "Lullawood writes a personalized bedtime story for your child every night — featuring their name, the animals and worlds they love, recurring characters, and the adventures from nights before. For the parents who still do bedtime properly.",
  applicationName: "Lullawood",
  openGraph: {
    title: "Lullawood — A new bedtime story every night, where your child is the hero",
    description: "The bedtime world where your child is the hero.",
    url: SITE_URL,
    siteName: "Lullawood",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lullawood — A new bedtime story every night, where your child is the hero",
    description: "The bedtime world where your child is the hero.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${title.variable} ${display.variable} ${body.variable}`}>
      <body>
        <JsonLd data={organizationLd()} />
        <JsonLd data={websiteLd()} />
        {children}
      </body>
    </html>
  );
}
