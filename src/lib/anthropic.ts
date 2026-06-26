import Anthropic from "@anthropic-ai/sdk";

// Server-side only. Key never reaches the browser.
export function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

export async function generateStory(prompt: string): Promise<string> {
  const client = getAnthropic();
  const msg = await client.messages.create({
    model: process.env.STORY_MODEL ?? "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
