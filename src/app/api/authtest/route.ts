import { getAuth } from "@/lib/auth";

export const runtime = "edge";

// Diagnostic: actually attempt a signup server-side and surface the real error.
export async function GET(): Promise<Response> {
  const steps: string[] = [];
  try {
    steps.push("getAuth()");
    const auth = getAuth();
    steps.push("auth built");

    const testEmail = `diag_${Date.now()}@example.com`;
    steps.push("calling signUpEmail for " + testEmail);

    const result = await auth.api.signUpEmail({
      body: { name: "Diag Test", email: testEmail, password: "test12345" },
    });
    steps.push("signUpEmail returned");

    return new Response(JSON.stringify({ ok: true, steps, result }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        steps,
        error: err?.message ?? String(err),
        name: err?.name ?? null,
        cause: err?.cause ? String(err.cause) : null,
        stack: err?.stack ?? null,
      }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
