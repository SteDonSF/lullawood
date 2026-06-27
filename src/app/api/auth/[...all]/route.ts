import { getAuth } from "@/lib/auth";

export const runtime = "edge";

// Better Auth's catch-all handler. Every /api/auth/* request — sign-up, sign-in,
// sign-out, session — is handled here. We build the auth instance per request
// (edge-safe: process.env is only available at request time).
async function handler(req: Request): Promise<Response> {
  const auth = getAuth();
  return auth.handler(req);
}

export const GET = handler;
export const POST = handler;
