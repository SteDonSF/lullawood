// Builds the story prompt. Recurring characters + previous adventures are what
// make "Lullawood remembers" real: we feed a short "story bible" summary in.

export type ChildProfile = {
  name: string;
  age?: number;
  animals?: string[];
  colors?: string[];
  interests?: string[];
};

export type StoryContext = {
  profile: ChildProfile;
  recurringCharacters?: string[];   // e.g. ["Pip the fox", "Luna the owl"]
  previousAdventures?: string[];    // one-line summaries of recent nights
  weeklyTheme?: string;             // e.g. "sharing"
  adventure?: string;               // optional override for the live demo
  color?: string;                   // optional override for the live demo
  animal?: string;                  // optional override for the live demo
};

export function buildStoryPrompt(ctx: StoryContext): string {
  const p = ctx.profile;
  const age = p.age ?? 5;
  const animals = ctx.animal ? [ctx.animal] : p.animals ?? [];
  const colors = ctx.color ? [ctx.color] : p.colors ?? [];
  const lines: string[] = [
    `Write a gentle bedtime story for a child of about age ${age}.`,
    `The hero is a child named ${p.name}.`,
    animals.length ? `Feature these friendly animal companions: ${animals.join(", ")}.` : "",
    colors.length ? `Fill the world with these colours: ${colors.join(", ")}.` : "",
    p.interests?.length ? `Weave in the things they love: ${p.interests.join(", ")}.` : "",
    ctx.adventure ? `Tonight's adventure is about: ${ctx.adventure}.` : "",
    ctx.recurringCharacters?.length
      ? `These recurring friends should appear and feel familiar: ${ctx.recurringCharacters.join(", ")}.`
      : "",
    ctx.previousAdventures?.length
      ? `Gently reference past adventures so the world feels continuous: ${ctx.previousAdventures.join("; ")}.`
      : "",
    ctx.weeklyTheme ? `Softly weave in the theme of ${ctx.weeklyTheme}, never preachy.` : "",
    `Rules: warm, soothing, completely age-appropriate — nothing scary, no peril, no conflict or violence.`,
    `About 180-220 words. Short, calm sentences. End with the characters growing sleepy and settling down to sleep, so it works as a wind-down right before bed.`,
    `Put a short whimsical title on the very first line, then a blank line, then the story. No commentary before or after.`,
  ];
  return lines.filter(Boolean).join("\n");
}
