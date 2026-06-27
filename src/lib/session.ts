import { getAuth } from "./auth";

// Server-side: who is logged in? Returns the user object or null.
// The single place server code resolves identity. Never trust a parentId
// sent from the browser — derive it from the verified session here.
export async function getSessionUser(headers: Headers) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers });
  return session?.user ?? null;
}
