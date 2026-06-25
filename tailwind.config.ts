import type { Config } from "tailwindcss";

/**
 * Lullawood design tokens — locked to the official style board.
 * Forest green, moss, lamp gold, warm cream, earth brown, dusty blue,
 * twilight blue, soft charcoal, parchment beige, candlelight amber.
 * Aged-paper base. No neon, no purple, no corporate navy.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // page paper (lighter than the warm-cream swatch, matches the board stock)
        parchment: { DEFAULT: "#EFE6D1", deep: "#E4D7BC", soft: "#F5EDDB" },
        cream: { DEFAULT: "#F1D5A9", paper: "#FBF6EA" },
        // text
        ink: { DEFAULT: "#2A3422", soft: "#433E2F", muted: "#6E6443" },
        // jewels
        gold: { DEFAULT: "#D28E28", deep: "#B7791A", text: "#9A6A18", amber: "#CE8C2C" },
        forest: { DEFAULT: "#2A3422", deep: "#16201A", bright: "#3E5B40" },
        moss: { DEFAULT: "#6D622C" },
        earth: { DEFAULT: "#764C19" },
        dusty: { DEFAULT: "#2E4650" },
        twilight: { DEFAULT: "#61635B" },
        charcoal: { DEFAULT: "#433E2F" },
        beige: { DEFAULT: "#EAC997" },
        border: { DEFAULT: "#D8C29A" },
      },
      fontFamily: {
        title: ["var(--font-title)", "Cinzel", "serif"],          // engraved caps — wordmark & eyebrows
        display: ["var(--font-display)", "Playfair Display", "serif"],
        body: ["var(--font-body)", "Nunito", "system-ui", "sans-serif"],
      },
      letterSpacing: { wordmark: "0.12em" },
      boxShadow: {
        page: "0 14px 34px rgba(70,55,25,.16)",
        lift: "0 22px 50px rgba(70,55,25,.22)",
        night: "inset 0 1px 0 rgba(255,255,255,.05), 0 18px 40px rgba(16,26,28,.34)",
      },
      backgroundImage: {
        "parchment-grad": "linear-gradient(180deg, #EFE6D1 0%, #E4D7BC 60%, #EFE6D1 100%)",
        // dusty-blue night sky + forest + warm horizon, with a candlelight-amber moon glow
        "night-scene":
          "radial-gradient(440px 440px at 82% 26%, rgba(210,142,40,.5), rgba(210,142,40,0) 62%), radial-gradient(150px 150px at 82% 26%, #F1D9A6, #CE8C2C 70%, rgba(206,140,44,0) 72%), linear-gradient(180deg,#233B40 0%,#1c2e2a 44%,#4a3a28 82%,#5c4a34 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
