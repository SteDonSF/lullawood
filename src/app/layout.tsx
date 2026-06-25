import type { Metadata } from "next";
import { Cinzel, Playfair_Display, Nunito } from "next/font/google";
import "./globals.css";

const title = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-title",
  display: "swap",
});
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
      <body>{children}</body>
    </html>
  );
}
