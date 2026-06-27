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
