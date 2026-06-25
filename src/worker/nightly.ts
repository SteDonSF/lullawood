/**
 * Lullawood nightly engine — Cloudflare Worker on a Cron Trigger.
 * Each run: find children whose local bedtime is in the next hour, generate
 * tonight's story (with their recurring characters + recent adventures),
 * narrate it, email it, and write the result + a one-line summary back to the
 * DB so tomorrow's story can remember tonight.
 *
 * This is wired as a typed skeleton. Fill the DB query + storage and deploy
 * with `npm run worker:deploy`.
 */
export interface Env {
  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  RESEND_API_KEY: string;
  DATABASE_URL: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(run(env));
  },
};

async function run(_env: Env) {
  // 1. const due = await childrenDueThisHour();           // query DB by tz + bedtime
  // 2. for each child:
  //      const prompt = buildStoryPrompt({ profile, recurringCharacters, previousAdventures, weeklyTheme });
  //      const story  = await generateStory(prompt);        // Anthropic
  //      const audio  = await narrate(storyBody);           // ElevenLabs -> store to R2, get url
  //      await sendEmail(parentEmail, storyEmailHtml(...));  // Resend
  //      await saveStory({ childId, title, body, summary, audioUrl }); // DB (feeds tomorrow)
  console.log("Lullawood nightly run — wire DB + storage to activate.");
}
