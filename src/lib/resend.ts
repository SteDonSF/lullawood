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
