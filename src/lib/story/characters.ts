// The Lullawood character bible.
// Each companion the demo offers maps to a named friend with a real personality,
// home, voice, and signature detail. The generator looks up the chosen companion
// and feeds the model who they *truly* are — so "Whale" becomes Waverley, not a
// generic animal. This is what makes the cast feel consistent night to night.

export type Character = {
  /** The plain word shown on the demo button (must match the ANIMALS list). */
  companion: string;
  /** The friend's proper name. */
  name: string;
  /** Species, for the model's reference. */
  species: string;
  /** Where they live in the Lullawood world. */
  home: string;
  /** One-line essence of who they are. */
  essence: string;
  /** Personality traits that should shape how they act. */
  traits: string;
  /** How they speak and carry themselves — their voice. */
  voice: string;
  /** A signature object/detail that always travels with them. */
  signature: string;
};

// Keyed by the lowercase companion word the demo sends (e.g. "whale").
export const CHARACTERS: Record<string, Character> = {
  fox: {
    companion: "Fox",
    name: "Fern",
    species: "fox",
    home: "the Whispering Woods, near a den lined with soft moss",
    essence: "kind and curious, the friend who welcomes every child to Lullawood",
    traits: "warm, gently inquisitive, quick to notice small wonders and point them out",
    voice: "soft and bright, asks gentle questions, never rushes",
    signature: "a russet tail she curls around friends like a blanket",
  },
  owl: {
    companion: "Owl",
    name: "Oliver",
    species: "owl",
    home: "a hollow high in the Story Oak, surrounded by old books",
    essence: "the wise keeper of bedtime tales",
    traits: "calm, thoughtful, patient; speaks a little slowly, as if every word is chosen",
    voice: "low and reassuring, fond of beginning things with 'Now, let me tell you…'",
    signature: "round spectacles and a single silver feather that catches the moonlight",
  },
  bunny: {
    companion: "Bunny",
    name: "Willow",
    species: "rabbit",
    home: "the burrows beneath Lantern Village",
    essence: "gentle and brave, the one who carries the lantern through the dark",
    traits: "tender-hearted but quietly courageous, steady when others are unsure",
    voice: "shy and sweet, grows braver as the story goes on",
    signature: "a little lantern she holds up to light the way for friends",
  },
  bear: {
    companion: "Bear",
    name: "Bramble",
    species: "bear",
    home: "a cozy cabin at the edge of the Whispering Woods",
    essence: "a loyal protector who loves warm cocoa and warmer hugs",
    traits: "big, gentle, dependable; makes everyone feel safe and looked-after",
    voice: "deep and slow and kind, with a rumbly, comforting laugh",
    signature: "a chipped mug of cocoa he shares with whoever needs warming up",
  },
  dragon: {
    companion: "Dragon",
    name: "Nimbus",
    species: "tiny dragon",
    home: "a cloud-cushioned nook above Star Harbor",
    essence: "a small, shy spark of magic learning to believe in himself",
    traits: "bashful, sweet, surprising; his little flame glows brighter when he's brave",
    voice: "quiet and a touch unsure, with sudden bursts of delight",
    signature: "a soft puff of warm light he breathes instead of fire",
  },
  whale: {
    companion: "Whale",
    name: "Waverley",
    species: "gentle whale",
    home: "the deep, still waters of Moon Lake, which he knows current by current",
    essence: "the calm, kind storyteller of the deep who helps friends find their courage",
    traits: "serene, patient, wise; sees the big picture and helps others breathe and slow down",
    voice: "slow, deep, and soothing, like tide against a quiet shore; a patient listener",
    signature: "a glowing shell lantern that sways on a rope as he drifts",
  },
  lion: {
    companion: "Lion",
    name: "Linden",
    species: "lion",
    home: "the heart of the Whispering Woods, which he watches over",
    essence: "the brave, loyal guardian of Lullawood who always stands up for what is right",
    traits: "courageous, fair, encouraging; a steady leader who listens before he acts",
    voice: "warm and strong and steady, the kind of voice that makes you feel safe",
    signature: "an antique brass compass on a cord that always points friends home",
  },
  unicorn: {
    companion: "Unicorn",
    name: "Luna",
    species: "unicorn",
    home: "the starlit edge of Dream Meadow, where the night is softest",
    essence: "the keeper of dreams and starlight, who helps friends believe in their own magic",
    traits: "kind, imaginative, hopeful; nurtures dreams and sees the wonder in everything",
    voice: "gentle and lilting and full of quiet wonder",
    signature: "a trail of soft starlight that follows wherever she steps",
  },
};

/** Look up a character by the demo's companion word. Returns undefined if unknown. */
export function getCharacter(companion?: string): Character | undefined {
  if (!companion) return undefined;
  return CHARACTERS[companion.trim().toLowerCase()];
}
