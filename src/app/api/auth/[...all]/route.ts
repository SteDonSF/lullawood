import { getAuth } from "@/lib/auth";

export const runtime = "edge";

// Catch-all auth handler. Wrapped in try/catch so the REAL error text is
// returned to the browser (temporarily) instead of a bare 500 — this lets us
// diagnose failures from the Network → Response tab.
async function handler(req: Request): Promise<Response> {
  try {
    const auth = getAuth();
    return await auth.handler(req);
  } catch (err: any) {
    const detail = {
      error: "auth_handler_failed",
      message: err?.message ?? String(err),
      stack: err?.stack ?? null,
    };
    return new Response(JSON.stringify(detail, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const GET = handler;
export const POST = handler;
