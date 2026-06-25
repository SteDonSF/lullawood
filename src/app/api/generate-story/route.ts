import { NextRequest, NextResponse } from "next/server";
import { generateStory } from "@/lib/anthropic";
import { buildStoryPrompt } from "@/lib/story/prompt";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { name, animal, adventure, color } = await req.json();
    const prompt = buildStoryPrompt({
      profile: { name: (name || "a curious little one").toString().slice(0, 40) },
      animal, adventure, color,
    });
    const story = await generateStory(prompt);
    if (!story) throw new Error("empty");
    return NextResponse.json({ story });
  } catch (e) {
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
