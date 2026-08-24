import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { AttributionTracker } from "@/components/AttributionTracker";
import "./globals.css";

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
  title: "Lullawood — A new bedtime story every night, where your child is the hero",
  description:
    "Lullawood writes a personalized bedtime story for your child every night — featuring their name, the animals and worlds they love, recurring characters, and the adventures from nights before. For the parents who still do bedtime properly.",
  openGraph: {
    title: "Lullawood",
    description: "The bedtime world where your child is the hero.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${title.variable} ${display.variable} ${body.variable}`}>
      <body>
        {/* Plausible. next/script + afterInteractive rather than a raw tag in
            <head>: it keeps the script off the critical path (bedtime traffic is
            mostly phones on home wifi) and lets Next handle injection once per
            app rather than per navigation. Mounted in the root layout, so it
            loads on every route — / and /try included.
            The init stub runs first and queues any track() call that fires
            before the remote script lands, so nothing is lost in that gap. */}
        <Script
          id="plausible-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};
              plausible.init=plausible.init||function(i){plausible.o=i||{}};
              plausible.init();
            `,
          }}
        />
        <Script
          src="https://plausible.io/js/pa-drqECpe-p2UURmZCWKuMi.js"
          strategy="afterInteractive"
        />
        <AttributionTracker />
        {children}
      </body>
    </html>
  );
}
