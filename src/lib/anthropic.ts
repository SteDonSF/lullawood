import Anthropic from "@anthropic-ai/sdk";
import { STORY_SYSTEM_PROMPT } from "./story/prompt";
// Server-side only. Key never reaches the browser.
export function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}
// Sonnet-class for the richer storytelling the product needs. Override with
// STORY_MODEL if you ever want to dial cost/quality without a code change.
const DEFAULT_MODEL = "claude-sonnet-4-6";
// Cheap/fast model for one-line summaries (memory). Summaries don't need the
// storytelling model — a small model keeps the memory loop near-free.
const SUMMARY_MODEL = "claude-haiku-4-5-20251001";
export async function generateStory(userPrompt: string): Promise<string> {
  const client = getAnthropic();
  const msg = await client.messages.create({
    model: process.env.STORY_MODEL ?? DEFAULT_MODEL,
    max_tokens: 2400,            // headroom for the longest (~7 min) story WITH its full ending — must never cut off at bedtime
    temperature: 0.8,            // a little warmth and variety in the prose
    system: STORY_SYSTEM_PROMPT, // the storyteller's craft + voice + safety
    messages: [{ role: "user", content: userPrompt }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
// ----- Memory: one-line summary of a finished story -----
// Used by the memory loop to record "what happened tonight" so tomorrow's story
// can call back to it (continuity) and avoid repeating it (anti-repetition).
// Deliberately tiny: cheap model, low tokens, plain instruction.
export async function summarizeStory(storyBody: string, childName: string): Promise<string> {
  try {
    const client = getAnthropic();
    const msg = await client.messages.create({
      model: process.env.SUMMARY_MODEL ?? SUMMARY_MODEL,
      max_tokens: 80,
      temperature: 0.3,
      system:
        "You write a single short factual sentence summarising a children's bedtime story, so it can be remembered next time. " +
        "Name the key friends, the adventure, and how it resolved. No preamble, no quotes, one sentence under 30 words.",
      messages: [
        {
          role: "user",
          content: `Summarise tonight's story about ${childName} in one short sentence:\n\n${storyBody.slice(0, 4000)}`,
        },
      ],
    });
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim()
      .slice(0, 300);
  } catch {
    // Memory is best-effort — never let a summary failure break story delivery.
    return "";
  }
}