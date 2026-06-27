import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Better Auth instance, created PER REQUEST (edge-safe: process.env is only
// populated per-request on Cloudflare, exactly like our getDb()).
export function getAuth() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  const db = drizzle(neon(url));

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret,
    baseURL: process.env.BETTER_AUTH_URL ?? "https://lullawood.com",
    emailAndPassword: {
      enabled: true,
    },
    // storeSessionInDatabase removed — it threw during signup session creation
    // on the Workers runtime. Sessions still persist via the drizzle adapter.
  });
}
