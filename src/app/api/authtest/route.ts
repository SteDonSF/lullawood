export const runtime = "edge";

// Standalone diagnostic — isolates WHERE auth construction fails.
export async function GET(): Promise<Response> {
  const steps: string[] = [];
  try {
    steps.push("start");
    steps.push("DATABASE_URL: " + (process.env.DATABASE_URL ? "present" : "MISSING"));
    steps.push("BETTER_AUTH_SECRET: " + (process.env.BETTER_AUTH_SECRET ? "present" : "MISSING"));
    steps.push("BETTER_AUTH_URL: " + (process.env.BETTER_AUTH_URL ?? "MISSING"));

    steps.push("importing better-auth");
    const { betterAuth } = await import("better-auth");
    steps.push("imported betterAuth OK");

    const { drizzleAdapter } = await import("better-auth/adapters/drizzle");
    steps.push("imported drizzleAdapter OK");

    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    steps.push("imported neon + drizzle OK");

    const db = drizzle(neon(process.env.DATABASE_URL!));
    steps.push("created db OK");

    const auth = betterAuth({
      database: drizzleAdapter(db, { provider: "pg" }),
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL ?? "https://lullawood.com",
      emailAndPassword: { enabled: true },
    });
    steps.push("constructed auth OK");

    return new Response(JSON.stringify({ ok: true, steps }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, steps, error: err?.message ?? String(err), stack: err?.stack ?? null }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
