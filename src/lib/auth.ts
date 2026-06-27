import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Better Auth instance, created PER REQUEST.
// On Cloudflare's edge, process.env is only populated per-request — like getDb().
// Creating the instance at module load would read undefined env vars and fail
// (the root of the 33s-hang / 503 reports in the wild).
//
// Sessions: stored in the database, cookie cache OFF — deliberately, to dodge
// better-auth bug #4203 (cookieCache mis-handles secondary-storage fallback and
// can log users out). Re-enable cookieCache only once that upstream bug is fixed.
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
    session: {
      storeSessionInDatabase: true,
      // cookieCache intentionally disabled — better-auth bug #4203.
    },
  });
}
