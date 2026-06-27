import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { Resend } from "resend";
import * as authSchema from "./auth-schema";

export function getAuth() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  const baseURL = process.env.BETTER_AUTH_URL ?? "https://lullawood.com";
  const db = drizzle(neon(url), { schema: authSchema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authSchema.user,
        session: authSchema.session,
        account: authSchema.account,
        verification: authSchema.verification,
      },
    }),
    secret,
    baseURL,
    trustedOrigins: ["https://lullawood.com", "https://www.lullawood.com"],
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error("RESEND_API_KEY is not set");
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: "Lullawood <noreply@lullawood.com>",
          to: user.email,
          subject: "Reset your Lullawood password",
          text: `Hi ${user.name || "there"},

We got a request to reset the password for your Lullawood account. Open this link to choose a new one:

${url}

This link expires in one hour. If you didn't ask to reset your password, you can safely ignore this email — nothing will change.

Goodnight, Lullawood`,
          html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#faf6ee;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #efe6d2;">
    <h1 style="font-size:20px;color:#2b2b2b;margin:0 0 16px;">Reset your password</h1>
    <p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 24px;">Hi ${user.name || "there"}, we got a request to reset the password for your Lullawood account. Tap the button below to choose a new one.</p>
    <a href="${url}" style="display:inline-block;background:#c8a24a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">Choose a new password</a>
    <p style="font-size:13px;line-height:1.6;color:#8a8a8a;margin:24px 0 0;">This link expires in one hour. If you didn't ask to reset your password, you can safely ignore this email — nothing will change.</p>
    <p style="font-size:13px;color:#b0a98f;margin:24px 0 0;">Goodnight, Lullawood 🌙</p>
  </div>
</div>`,
        });
      },
    },
  });
}
