// =============================================================================
// access.ts — the admin wall.
// -----------------------------------------------------------------------------
// THE HOLE THIS CLOSES (found 2026-08-22, live in production at the time):
//   Cloudflare Access is bound to the HOSTNAME lullawood.com. The Pages project
//   also answers on lullawood.pages.dev and on a per-deployment
//   <hash>.lullawood.pages.dev — and those hostnames have no Access app in
//   front of them. Every /api/admin route was therefore reachable, unauthenticated,
//   by anyone who guessed the pages.dev URL.
//
//   The previous guard on /api/admin/access-codes only checked that the header
//   `Cf-Access-Jwt-Assertion` was PRESENT. Cloudflare sets that header, but
//   nothing stops a client from sending it too — a literal
//   `Cf-Access-Jwt-Assertion: not-a-real-jwt` sailed straight through.
//
// THE FIX, in two independent layers — either one alone closes the bypass:
//   1. HOST ALLOWLIST. Admin routes answer only on the canonical hostnames that
//      actually sit behind Access. A request to *.pages.dev is refused before
//      anything else runs. This needs no configuration, so it holds from the
//      moment it deploys.
//   2. REAL JWT VERIFICATION. When CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD are
//      set, the assertion is cryptographically verified against Cloudflare's
//      published JWKS — RS256 signature, audience, issuer, and expiry. A forged
//      header fails at the signature.
//
//   Layer 2 needs config, so it degrades to presence-only when unset. That is
//   safe ONLY because layer 1 guarantees the request arrived on a hostname
//   where Cloudflare itself injected the header. Do not remove the host
//   allowlist on the theory that the JWT check covers it — until the env vars
//   are set, the allowlist IS the security boundary.
// =============================================================================

/** Hostnames that genuinely sit behind the Cloudflare Access app. */
const CANONICAL_HOSTS = new Set(["lullawood.com", "www.lullawood.com"]);

/** e.g. "lullawood.cloudflareaccess.com" */
const TEAM_DOMAIN = process.env.CF_ACCESS_TEAM_DOMAIN;
/** The Access application's Audience (AUD) tag, from the Access app's settings. */
const AUD = process.env.CF_ACCESS_AUD;

export type AccessIdentity = {
  email: string | null;
  /** True only when the JWT was cryptographically verified. */
  verified: boolean;
};

export type AccessDenial = { ok: false; status: 403; reason: string };
export type AccessGrant = { ok: true; identity: AccessIdentity };

// --- base64url ---------------------------------------------------------------

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  // Backed by a plain ArrayBuffer (not SharedArrayBuffer) so it satisfies
  // BufferSource for crypto.subtle.verify.
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
  } catch {
    return null;
  }
}

// --- JWKS --------------------------------------------------------------------

type Jwk = JsonWebKey & { kid?: string; alg?: string };
let jwksCache: { keys: Jwk[]; at: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000; // Cloudflare rotates rarely; an hour is plenty.

async function getJwks(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache = { keys, at: Date.now() };
  return keys;
}

/**
 * Verify a Cloudflare Access JWT. Returns the identity, or null on ANY problem —
 * bad signature, wrong audience, wrong issuer, expired, unknown key, malformed.
 * Never throws.
 */
async function verifyJwt(token: string): Promise<AccessIdentity | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [rawHeader, rawPayload, rawSig] = parts;

    const header = b64urlToJson(rawHeader);
    if (!header) return null;
    // Pin the algorithm. Without this, a token claiming alg:"none" — or an HMAC
    // algorithm verified against a public key — could be accepted.
    if (header.alg !== "RS256") return null;
    const kid = typeof header.kid === "string" ? header.kid : null;
    if (!kid) return null;

    const jwk = (await getJwks()).find((k) => k.kid === kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(rawSig),
      signed
    );
    if (!ok) return null;

    const payload = b64urlToJson(rawPayload);
    if (!payload) return null;

    // Audience — Access sets this to the application's AUD tag. This is what
    // stops a valid token minted for a DIFFERENT app in the same team from
    // working here.
    const aud = payload.aud;
    const audList = Array.isArray(aud) ? aud.map(String) : typeof aud === "string" ? [aud] : [];
    if (!AUD || !audList.includes(AUD)) return null;

    // Issuer must be our own team domain.
    if (payload.iss !== `https://${TEAM_DOMAIN}`) return null;

    // Expiry / not-before, with 60s of clock skew.
    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    const nbf = typeof payload.nbf === "number" ? payload.nbf : 0;
    if (exp <= now - 60) return null;
    if (nbf > now + 60) return null;

    const email =
      typeof payload.email === "string"
        ? payload.email
        : typeof payload.common_name === "string"
        ? payload.common_name // service-token access
        : null;

    return { email, verified: true };
  } catch {
    return null; // JWKS unreachable, malformed key, anything — fail closed
  }
}

/**
 * The gate every /api/admin route calls first.
 *
 * Returns a denial you should return verbatim, or a grant carrying the
 * verified identity. Fails closed on every ambiguous path.
 */
export async function requireAccess(req: Request): Promise<AccessGrant | AccessDenial> {
  // --- Layer 1: hostname. ---------------------------------------------------
  // The bypass was never a missing token, it was a hostname Access doesn't
  // cover. Check it first and unconditionally.
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (!CANONICAL_HOSTS.has(host)) {
    return { ok: false, status: 403, reason: "admin routes are served only on lullawood.com" };
  }

  const token =
    req.headers.get("Cf-Access-Jwt-Assertion") ??
    readCookie(req.headers.get("cookie"), "CF_Authorization");
  if (!token) {
    return { ok: false, status: 403, reason: "no Cloudflare Access assertion" };
  }

  // --- Layer 2: cryptographic verification, when configured. ----------------
  if (TEAM_DOMAIN && AUD) {
    const identity = await verifyJwt(token);
    if (!identity) return { ok: false, status: 403, reason: "invalid Access assertion" };
    return { ok: true, identity };
  }

  // Unconfigured: presence only. Safe solely because layer 1 already proved the
  // request came in on a hostname that Access sits in front of — Cloudflare
  // strips any client-supplied copy of this header on those hostnames.
  // Set CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD to promote this to a real check.
  return { ok: true, identity: { email: null, verified: false } };
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}
