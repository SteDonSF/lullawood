// Builds the Lullawood story prompts.
//
// We split generation into TWO prompts:
//   - SYSTEM: the storyteller's craft and voice. Constant. This is what makes the
//     prose strong — it sets the rhythm, the sensory texture, the emotional arc.
//   - USER: this child's specific brief (name, age, chosen friend's bible,
//     adventure, colour, optional co-star) plus any memory the product layer
//     supplies later.
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

export type CoStar = {
  name: string;
  age?: number;
};

export type StoryContext = {
  profile: ChildProfile;
  costar?: CoStar;                  // optional sibling/friend who co-stars
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
- Write real prose, not a summary. Show the world through the senses — the smell of cocoa, the hush of water, lantern light on leaves, the warmth of a friend close by. Keep sensations vivid but never harsh: nothing loud, sharp, or startling.
- Give the story a true emotional arc in four beats: (1) the child (and any co-star) arrives in Lullawood and meets their friend; (2) an adventure unfolds whose excitement is matched to the child's age — gentle wonder for the littlest, a real challenge or contest for bigger kids; (3) a turning point where courage, cleverness, kindness, or teamwork carries the day and the child triumphs; (4) the celebration softens, the world grows quiet, and everyone — especially the child — grows sleepy and settles to rest.
- Honour each friend's personality and voice exactly as given. Let them speak and act like themselves.
- Use the child's name (and the co-star's, if any) naturally and often, so they feel like the true heroes.

THE STAKES SCALE WITH AGE (you'll be told the age)
Every Lullawood story carries the child UP into a little adventure and then DOWN into sleep. How high the "up" climbs depends on the child's age:
- Around 3–5: the gentlest wonder. The "problem" is tiny and sweet — a lost lantern, a shy star, a friend who needs cheering. No real tension; pure softness and reassurance.
- Around 6–8: a real little plot with genuine but friendly stakes — a game to win, a goal to reach, a puzzle to solve, a challenge to rise to. Let there be excitement, a brave or clever turning point, and a satisfying triumph — then the wind-down.
- Around 9–10: a proper adventure with real (always friendly) tension, cleverness, humour, a worthy rival, and a hard-won victory — written a little richer and longer. Still always resolving warmly.
Whatever the age, the "up" is exciting, never frightening — and the story ALWAYS comes back down to calm.

EMOTIONAL SAFETY (never break these)
- No violence, blood, injury, death, cruelty, real danger or peril, or anything that could genuinely frighten a child.
- Any rival is a FRIENDLY rival (a rival team, a competitor in a race); any "opponent" is at most a bit cheeky, grumpy, or comical, never menacing or scary.
- Challenges are exciting, not threatening. The child always succeeds, and always ends safe, warm, and loved.
- No romance, no adult themes, nothing inappropriate for a young child.

THE WIND-DOWN (absolute, at every age)
No matter how exciting the middle gets, the final third must DESCEND. The excitement settles, the cheers fade to a hush, the world quiets, sentences grow shorter and slower, and the child grows sleepy and safe and drifts toward sleep. End almost in a whisper. This rule is never broken, for any age.

FORMAT
- First line: a short, whimsical title (no quotation marks, no "Title:").
- Then a blank line.
- Then the story itself.
- No notes, no preamble, no commentary before or after. Only the title and the story.`;

// ----- Age-specific direction for the user prompt. -----
function ageGuidance(age: number, name: string): string {
  if (age <= 5) {
    return `${name} is about ${age} — write for a little one. Simple words, short musical sentences, gentle repetition. Keep the adventure tiny and full of wonder, with no real tension — just softness, warmth, and reassurance.`;
  }
  if (age <= 8) {
    return `${name} is ${age} — old enough for a REAL little story. Give a genuine plot with friendly stakes: a goal to reach, a game to win, a challenge to rise to. Let there be excitement, a clever or brave turning point, and a properly satisfying triumph — then wind it all the way down to sleep. Richer words than for a toddler, room for a little humour, but never frightening.`;
  }
  return `${name} is ${age} — write a proper adventure with real (friendly) tension, cleverness, and humour: a worthy rival, a hard-won victory, a payoff that genuinely lands. Richer vocabulary, a little longer. Still always warm — and still always descending into calm sleep at the end.`;
}

// ----- This child's specific brief. -----
export function buildStoryUserPrompt(ctx: StoryContext): string {
  const p = ctx.profile;
  const age = p.age ?? 5;
  const character = getCharacter(ctx.animal);
  const costar = ctx.costar?.name ? ctx.costar : undefined;

  // For a co-star pair, pitch the whole story to the OLDER child.
  const pitchAge = costar?.age ? Math.max(age, costar.age) : age;

  const colors = ctx.color ? [ctx.color] : p.colors ?? [];
  const lines: string[] = [
    `Write tonight's Lullawood bedtime story.`,
    ``,
    costar
      ? `THE HEROES: ${p.name} (about ${age}) and ${costar.name}${costar.age ? ` (about ${costar.age})` : ""}, together. Both are heroes of this adventure.`
      : `THE HERO: a child named ${p.name}, about ${age} years old. Make ${p.name} the hero of the adventure.`,
    ``,
    `HOW TO PITCH IT: ${ageGuidance(pitchAge, costar ? `${p.name} and ${costar.name}` : p.name)}`,
  ];

  // Co-star partnership detail.
  if (costar) {
    lines.push(
      ``,
      `THE PARTNERSHIP: give ${p.name} and ${costar.name} a real bond — they help each other, tease a little and laugh, and combine to win the day. In a game or contest, let them set each other up for the decisive moment so they triumph *together*. Neither is a sidekick; both shine.`,
    );
  }

  // The chosen friend, fully characterised from the bible.
  if (character) {
    lines.push(
      ``,
      `TONIGHT'S FRIEND: ${character.name}, ${character.essence}.`,
      `- Who they are: ${character.traits}.`,
      `- Their voice: ${character.voice}.`,
      `- Their home: ${character.home}.`,
      `- Always with them: ${character.signature}.`,
      `Bring ${character.name} fully to life — let them speak and behave exactly like this, sharing the adventure as a guide and friend.`,
    );
  } else if (ctx.animal) {
    lines.push(``, `TONIGHT'S FRIEND: a gentle ${ctx.animal.toLowerCase()} companion who is kind and warm.`);
  }

  if (ctx.adventure) {
    lines.push(``, `TONIGHT'S ADVENTURE: themed around "${ctx.adventure}".`);
    // Interest → real premise for older kids: turn a sport/contest into a genuine event.
    if (pitchAge >= 6) {
      lines.push(
        `If this is a sport, game, race, or contest (football and the like), make it a REAL event with a friendly rival team or opponent — invent a whimsical name for them (a team like "Sleepy Hollow United", say) — and let the hero${costar ? "es" : ""} rise to the big moment and score or win the decisive play. Build genuine excitement and a triumphant finish before the wind-down. If it isn't a contest, still give it a real shape: a goal, a discovery, a problem cleverly solved.`,
      );
    } else {
      lines.push(`Keep it calm and full of gentle wonder, free of any real tension.`);
    }
  }

  if (colors.length) {
    lines.push(``, `COLOUR: let ${colors.join(" and ")} glow softly through the scenery.`);
  }
  if (p.interests?.length) {
    lines.push(``, `THINGS ${p.name.toUpperCase()} LOVES: weave in naturally — ${p.interests.join(", ")}.`);
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

  // Length scales with age — older kids get a meatier story.
  const wordTarget = pitchAge <= 5 ? "250–350" : pitchAge <= 8 ? "400–550" : "500–650";
  lines.push(
    ``,
    `LENGTH: roughly ${wordTarget} words — long enough to feel like a real story, short enough for one bedtime.`,
    `Remember: however exciting the middle, end almost in a whisper, with ${costar ? `${p.name} and ${costar.name}` : p.name} growing sleepy and safe and settling down to rest.`,
  );

  return lines.filter((l) => l !== undefined).join("\n");
}

// ----- Back-compat shim -----
// The old code called buildStoryPrompt(ctx) and got a single string. The route
// still calls it this way; we keep it working by returning the user prompt.
export function buildStoryPrompt(ctx: StoryContext): string {
  return buildStoryUserPrompt(ctx);
}
