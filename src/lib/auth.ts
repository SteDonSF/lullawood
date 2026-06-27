import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Per-request (edge-safe). Hardened so it does NOT depend on BETTER_AUTH_URL:
// we fall back to the known production origin and trust it explicitly, so the
// sign-up / sign-in origin check always passes.
export function getAuth() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  const baseURL = process.env.BETTER_AUTH_URL ?? "https://lullawood.com";
  const db = drizzle(neon(url));

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret,
    baseURL,
    trustedOrigins: ["https://lullawood.com", "https://www.lullawood.com"],
    emailAndPassword: { enabled: true },
  });
}
