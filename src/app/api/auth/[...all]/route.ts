import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "edge";

// Per-request: build the auth instance inside the handler (edge-safe), then
// hand off to Better Auth's official Next.js handler.
export async function GET(req: Request): Promise<Response> {
  return toNextJsHandler(getAuth().handler).GET(req);
}

export async function POST(req: Request): Promise<Response> {
  return toNextJsHandler(getAuth().handler).POST(req);
}
