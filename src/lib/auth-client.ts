import { createAuthClient } from "better-auth/react";

// Browser-side auth helper. Talks to our /api/auth/* handler.
// baseURL defaults to the current origin, so it works on localhost and prod alike.
export const authClient = createAuthClient();

export const { signUp, signIn, signOut, useSession } = authClient;
