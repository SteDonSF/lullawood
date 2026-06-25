/**
 * Lullawood emblem — gold ring around a forest-green pine, with sparkles
 * and a tiny village at its base. Matches the official brand board.
 */
export function Mark({ size = 30, ring = "#D28E28", pine = "#2A3422", accent = "#D28E28" }: {
  size?: number; ring?: string; pine?: string; accent?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ flex: "none" }}>
      {/* ring */}
      <circle cx="32" cy="32" r="28.5" stroke={ring} strokeWidth="1.6" />
      {/* sparkles, upper right */}
      <g fill={accent}>
        <path d="M45 15 l1.1 2.6 2.6 1.1 -2.6 1.1 -1.1 2.6 -1.1 -2.6 -2.6 -1.1 2.6 -1.1z" />
        <path d="M50.5 23 l.8 1.8 1.8 .8 -1.8 .8 -.8 1.8 -.8 -1.8 -1.8 -.8 1.8 -.8z" />
        <circle cx="44.5" cy="26.5" r="1" />
      </g>
      {/* layered pine */}
      <g fill={pine}>
        <path d="M32 12 L26 24 L38 24 Z" />
        <path d="M32 19 L24 33 L40 33 Z" />
        <path d="M32 27 L22 43 L42 43 Z" />
        <rect x="30.4" y="42" width="3.2" height="6" rx="1" />
      </g>
      {/* tiny village + ground at the base */}
      <g fill={accent}>
        <path d="M16 49 q16 6 32 0 q-16 4 -32 0z" opacity="0.9" />
        <path d="M20 47 h3 v-2 l1.5 -1.5 1.5 1.5 v2 h3 v0 q-4.5 1 -9 0z" opacity="0.85" />
        <path d="M40 47 h2.6 v-1.7 l1.3 -1.3 1.3 1.3 v1.7 h2.6 q-4 1 -7.8 0z" opacity="0.85" />
      </g>
    </svg>
  );
}
