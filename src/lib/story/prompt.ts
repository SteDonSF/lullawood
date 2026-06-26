// Builds the Lullawood story prompts.
//
// We split generation into TWO prompts:
//   - SYSTEM: the storyteller's craft and voice. Constant. This is what makes the
//     prose strong — it sets the rhythm, the sensory texture, the emotional arc.
//   - USER: this child's specific brief (name, chosen friend's bible, adventure,
//     colour) plus any memory the product layer supplies later.
//
// "Lullawood remembers" plugs in here: recurringCharacters + previousAdventures
// are already threaded through, ready for the product engine to fill.

import { getCharacter } from "./characters";

export type ChildProfile = {
  name: string;
  age?: number;
  animals?: string[];
  colors?: string[];
  interests?: string[];
};

export type StoryContext = {
  profile: ChildProfile;
  recurringCharacters?: string[];   // e.g. ["Fern the fox", "Oliver the owl"]
  previousAdventures?: string[];    // one-line summaries of recent nights
  weeklyTheme?: string;             // e.g. "sharing"
  adventure?: string;               // demo: tonight's adventure
  color?: string;                   // demo: favourite colour
  animal?: string;                  // demo: chosen companion (maps to a character)
};

// ----- The storyteller. Constant craft + voice + safety. -----
export const STORY_SYSTEM_PROMPT = `You are the storyteller of Lullawood — a gentle, magical bedtime world where every child is the hero of their own nightly adventure. You write the kind of bedtime story a loving parent would treasure reading aloud: warm, beautiful, and quietly enchanting, built to carry a child softly down toward sleep.

THE LULLAWOOD WORLD
Lullawood is a moonlit world of lanterns and warm windows. Its places recur: the Story Oak (a great oak cradling a glowing book), Lantern Village (cottages and wooden bridges among the trees), Moon Lake (still water under an enormous moon), the Whispering Woods (ancient trees and tiny lanterns, beautiful and never frightening), Star Harbor (little boats beneath the stars), and Dream Meadow (where stories end before children wake). Draw on these places when they fit; let the world feel familiar and beloved.

YOUR CRAFT
- Write real prose, not a summary. Show the world through the senses — the smell of cocoa, the hush of water, lantern light on leaves, the warmth of a friend close by — but keep every sensation calm and soft. Nothing loud, sharp, or startling.
- Give the story a true emotional arc in four gentle beats: (1) the child arrives in Lullawood and meets their friend; (2) a small, wonder-filled adventure unfolds, with the gentlest possible wrinkle — a lost lantern, a shy star, a friend who needs cheering — never danger; (3) a warm turning point where kindness, courage, or imagination quietly carries the day; (4) the day winds down and everyone, including the child, grows pleasantly sleepy and settles to rest.
- The energy must DESCEND across the story. Begin with a little gentle brightness and end almost in a whisper, sentences growing shorter and slower, until sleep feels like the natural next breath.
- Honour each friend's personality and voice exactly as given. Let them speak and act like themselves.
- Match vocabulary and sentence length to the child's age. Younger: simpler words, shorter sentences, more repetition and rhythm. Older: a little more richness, but always calm.
- Use the child's name naturally and often, so they feel like the true hero.

ABSOLUTE SAFETY RULES (never break these)
- Nothing scary, ever: no danger, peril, violence, conflict, villains, injury, death, darkness-as-threat, or anything a small child could find unsettling.
- No romance, no adult themes, no anything inappropriate for a young child.
- The "problem" in any story is never frightening — only gentle and easily, kindly resolved.

FORMAT
- First line: a short, whimsical title (no quotation marks, no "Title:").
- Then a blank line.
- Then the story itself.
- No notes, no preamble, no commentary before or after. Only the title and the story.`;

// ----- This child's specific brief. -----
export function buildStoryUserPrompt(ctx: StoryContext): string {
  const p = ctx.profile;
  const age = p.age ?? 5;
  const character = getCharacter(ctx.animal);

  const colors = ctx.color ? [ctx.color] : p.colors ?? [];
  const lines: string[] = [
    `Write tonight's Lullawood bedtime story.`,
    ``,
    `THE HERO: a child named ${p.name}, about ${age} years old. Make ${p.name} the hero of the adventure.`,
  ];

  // The chosen friend, fully characterised from the bible.
  if (character) {
    lines.push(
      ``,
      `TONIGHT'S FRIEND: ${character.name}, ${character.essence}.`,
      `- Who they are: ${character.traits}.`,
      `- Their voice: ${character.voice}.`,
      `- Their home: ${character.home}.`,
      `- Always with them: ${character.signature}.`,
      `Bring ${character.name} fully to life — let them speak and behave exactly like this. ${p.name} and ${character.name} share the adventure together.`,
    );
  } else if (ctx.animal) {
    lines.push(``, `TONIGHT'S FRIEND: a gentle ${ctx.animal.toLowerCase()} companion who is kind and warm.`);
  }

  if (ctx.adventure) {
    lines.push(``, `TONIGHT'S ADVENTURE: something gentle and wonder-filled themed around "${ctx.adventure}". Keep it calm and free of any danger.`);
  }
  if (colors.length) {
    lines.push(``, `COLOUR: let ${colors.join(" and ")} glow softly through the scenery.`);
  }
  if (p.interests?.length) {
    lines.push(``, `THINGS ${p.name.toUpperCase()} LOVES: weave in, lightly — ${p.interests.join(", ")}.`);
  }

  // ----- Memory layer (filled by the product engine; empty in the demo) -----
  if (ctx.recurringCharacters?.length) {
    lines.push(``, `FAMILIAR FRIENDS who should appear and feel already-known: ${ctx.recurringCharacters.join(", ")}.`);
  }
  if (ctx.previousAdventures?.length) {
    lines.push(
      ``,
      `CONTINUITY — gently call back to recent nights so the world feels ongoing (don't re-explain them, just let them feel remembered): ${ctx.previousAdventures.join("; ")}.`,
    );
  }
  if (ctx.weeklyTheme) {
    lines.push(``, `QUIET THEME for this week, woven in softly and never preachy: ${ctx.weeklyTheme}.`);
  }

  lines.push(
    ``,
    `LENGTH: roughly 350–450 words — long enough to feel like a real story, short enough for one bedtime.`,
    `Remember: end almost in a whisper, with ${p.name} growing sleepy and safe and settling down to rest.`,
  );

  return lines.filter((l) => l !== undefined).join("\n");
}

// ----- Back-compat shim -----
// The old code called buildStoryPrompt(ctx) and got a single string. Some callers
// may still do that. We keep it working by returning the user prompt; the route
// should prefer the system+user split via generateStory below.
export function buildStoryPrompt(ctx: StoryContext): string {
  return buildStoryUserPrompt(ctx);
}
