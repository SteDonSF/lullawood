import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export function storyEmailHtml(opts: { childName: string; title: string; body: string; audioUrl?: string }) {
  // The nightly email keeps the dark "night window" feel.
  const paragraphs = opts.body.split("\n").filter(Boolean).map((p) => `<p style="margin:0 0 14px;line-height:1.75">${p}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#0f1a14;padding:28px;font-family:Georgia,serif">
    <div style="max-width:560px;margin:0 auto;background:linear-gradient(180deg,#1c2f26,#142019);border:1px solid #102019;border-radius:18px;padding:30px;color:#FBF5E9">
      <p style="color:#F4C95D;letter-spacing:.1em;text-transform:uppercase;font-size:12px;margin:0 0 10px">Tonight in Lullawood</p>
      <h1 style="font-style:italic;color:#F4C95D;font-size:24px;margin:0 0 16px">${opts.title}</h1>
      ${paragraphs}
      ${opts.audioUrl ? `<a href="${opts.audioUrl}" style="display:inline-block;margin-top:14px;background:#F4C95D;color:#3a2d05;text-decoration:none;font-family:Arial;font-weight:bold;padding:12px 20px;border-radius:999px">▶ Listen to tonight's story</a>` : ""}
    </div>
  </body></html>`;
}

// =============================================================================
// Transactional lifecycle emails (welcome + Stripe dunning). All send from
// hello@lullawood.com on the verified lullawood.com domain. Each returns
// { success, error? } and never throws — callers treat email as best-effort.
// =============================================================================
const FROM = "Lullawood <hello@lullawood.com>";
const APP_URL = process.env.BETTER_AUTH_URL || "https://lullawood.com";

export type EmailResult = { success: boolean; id?: string; error?: string };

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<EmailResult> {
  try {
    const { data, error } = await getResend().emails.send({ from: FROM, to, subject, text, html });
    if (error) return { success: false, error: (error as { message?: string }).message ?? String(error) };
    return { success: true, id: data?.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Clean, light, warm-branded wrapper — cream card, ink text, one gold button.
function shell(heading: string, paragraphs: string[], button?: { label: string; href: string }): string {
  const paras = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#2A3422">${p}</p>`)
    .join("");
  const btn = button
    ? `<a href="${button.href}" style="display:inline-block;margin:6px 0 4px;background:#D28E28;color:#3a2d05;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:999px">${button.label}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F2EAD8;padding:32px 16px;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:520px;margin:0 auto;background:#FBF6EA;border:1px solid #EADBBE;border-radius:18px;padding:32px 30px">
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;font-size:12px;font-weight:bold;color:#D28E28">Lullawood</p>
    <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#2A3422">${heading}</h1>
    ${paras}${btn}
    <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#8a7d63;font-family:Arial,sans-serif">Lullawood — a new bedtime story every night. You're receiving this because you have a Lullawood account.</p>
  </div>
</body></html>`;
}

export function sendWelcomeEmail(to: string, firstName: string): Promise<EmailResult> {
  const subject = `Welcome to Lullawood, ${firstName} ✨`;
  const text =
    `Welcome to Lullawood, ${firstName}. Your free trial has started — the next 7 nights are on us. ` +
    `Tonight, open Lullawood, tell us a little about your child, and a bedtime story written just for them ` +
    `will be ready to read aloud together. We're so glad you're here.\n\nOpen your dashboard: ${APP_URL}/dashboard`;
  const html = shell(
    `Welcome to Lullawood, ${firstName} ✨`,
    [
      `Your free trial has started — the next 7 nights are on us. Tonight, open Lullawood, tell us a little about your child, and a bedtime story written just for them will be ready to read aloud together. We're so glad you're here.`,
    ],
    { label: "Open your dashboard", href: `${APP_URL}/dashboard` }
  );
  return sendEmail(to, subject, text, html);
}

export function sendTrialEndingEmail(to: string, firstName: string, trialEndDate: string): Promise<EmailResult> {
  const subject = "Your Lullawood trial ends in 2 days";
  const text =
    `Hi ${firstName} — your Lullawood free trial ends on ${trialEndDate}. This past week you've been able to ` +
    `create a fresh, personalized bedtime story every night, with characters and adventures that carry over and ` +
    `grow with your child. When the trial ends, that goes on pause. If you'd like to keep tonight's stories coming, ` +
    `choose a plan below. If not, there's nothing to do — you won't be charged.\n\nChoose a plan: ${APP_URL}/pricing`;
  const html = shell(
    "Your free trial ends soon",
    [
      `Hi ${firstName} — your Lullawood free trial ends on <strong>${trialEndDate}</strong>.`,
      `This past week you've been able to create a fresh, personalized bedtime story every night, with characters and adventures that carry over and grow with your child. When the trial ends, that goes on pause.`,
      `If you'd like to keep tonight's stories coming, you can choose a plan below. If not, there's nothing to do — you won't be charged.`,
    ],
    { label: "Choose a plan", href: `${APP_URL}/pricing` }
  );
  return sendEmail(to, subject, text, html);
}

export function sendPaymentFailedEmail(to: string, firstName: string): Promise<EmailResult> {
  const subject = "There was a problem with your Lullawood payment";
  const text =
    `Hi ${firstName} — we weren't able to process your latest Lullawood payment, so your access is paused for now. ` +
    `This is usually something small, like an expired card or a temporary bank hold. Once you update your payment ` +
    `details, your nightly stories pick up right where you left off.\n\nUpdate your card: ${APP_URL}/dashboard`;
  const html = shell(
    "There was a problem with your payment",
    [
      `Hi ${firstName} — we weren't able to process your latest Lullawood payment, so your access is paused for now.`,
      `This is usually something small, like an expired card or a temporary bank hold. Once you update your payment details, your nightly stories pick up right where you left off.`,
    ],
    { label: "Update your card", href: `${APP_URL}/dashboard` }
  );
  return sendEmail(to, subject, text, html);
}

export function sendPaymentRecoveredEmail(to: string, firstName: string): Promise<EmailResult> {
  const subject = "You're all set — Lullawood access restored";
  const text =
    `Good news, ${firstName} — your payment went through and your Lullawood access is back. ` +
    `Tonight's story is ready whenever you are.\n\nOpen your dashboard: ${APP_URL}/dashboard`;
  const html = shell(
    "You're all set — access restored",
    [`Good news, ${firstName} — your payment went through and your Lullawood access is back. Tonight's story is ready whenever you are.`],
    { label: "Open your dashboard", href: `${APP_URL}/dashboard` }
  );
  return sendEmail(to, subject, text, html);
}

// Escape model-generated story text + user-supplied names before HTML interpolation.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =============================================================================
// Nightly story delivery — the warm "tonight's story is ready" email the nightly
// cron sends for each generated story. Same cream/gold storybook look as the
// lifecycle emails (light card, serif title, one gold button) but with room for
// the full story body. Returns EmailResult; never throws.
// =============================================================================
export function sendNightlyStoryEmail(
  to: string,
  firstName: string,
  childName: string,
  storyTitle: string,
  storyBody: string,
  dashboardUrl: string,
): Promise<EmailResult> {
  const subject = `Tonight's story for ${childName} is ready ✨`;

  const paras = storyBody
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.8;color:#2A3422">${esc(p)}</p>`)
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#F2EAD8;padding:32px 16px;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:560px;margin:0 auto;background:#FBF6EA;border:1px solid #EADBBE;border-radius:18px;padding:32px 30px">
    <div style="text-align:center;margin:0 0 14px"><img src="https://lullawood.com/logo.png" width="48" height="48" alt="Lullawood" style="display:inline-block;width:48px;height:48px;border:0" /></div>
    <p style="margin:0 0 4px;font-family:Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;font-size:12px;font-weight:bold;color:#D28E28">Lullawood</p>
    <p style="margin:0 0 22px;font-family:Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;font-size:11px;color:#8a7d63">A new story every night</p>
    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#8a7d63">${esc(childName)}&rsquo;s story for tonight</p>
    <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#2A3422">${esc(storyTitle)}</h1>
    ${paras}
    <a href="${dashboardUrl}" style="display:inline-block;margin:10px 0 4px;background:#D28E28;color:#3a2d05;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:999px">Read it together tonight &rarr;</a>
    <p style="margin:12px 0 0;font-size:13px;color:#8a7d63;text-align:center;font-family:Arial,sans-serif">Tomorrow&rsquo;s story is already being written for ${esc(childName)}.</p>
    <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#8a7d63;font-family:Arial,sans-serif">You&rsquo;re receiving this because you have a Lullawood subscription. Manage your account at <a href="${dashboardUrl}" style="color:#9A6A18">lullawood.com/dashboard</a>.</p>
  </div>
</body></html>`;

  const text =
    `A new story every night — Lullawood\n\n` +
    `Hi ${firstName},\n\n${childName}'s story for tonight is ready:\n\n` +
    `${storyTitle}\n\n${storyBody.trim()}\n\n` +
    `Read it together tonight: ${dashboardUrl}\n\n` +
    `Tomorrow's story is already being written for ${childName}.\n\n` +
    `You're receiving this because you have a Lullawood subscription. Manage your account at lullawood.com/dashboard`;

  return sendEmail(to, subject, text, html);
}
