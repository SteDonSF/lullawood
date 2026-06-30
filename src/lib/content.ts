// All site copy lives here so it's easy to edit without touching components.

export const BRAND = {
  name: "Lullawood",
  tagline: "The bedtime world where your child is the hero.",
};

export const HERO = {
  headline: "For the parents who still do bedtime properly.",
  sub: "The bedtime world where your child is the hero.",
  body:
    "A new personalized story every night — featuring your child, the animals and worlds they love, and the friends they met in last night's adventure. Yours to read aloud at bedtime.",
  cta: "Write their first story free",
};

export const DEMO = {
  eyebrow: "See the magic first",
  heading: "Type your child's name. Watch their story appear.",
  sub: "No account, no email. Just a glimpse of what arrives every night.",
};

export type Reason = { title: string; body: string; art: string };
export const REASONS: Reason[] = [
  { title: "Your child is the hero", body: "Every story stars your child by name, with the companions and worlds they love — written for them, tonight. Never a template with a name dropped in.", art: "reason-hero" },
  { title: "Lullawood remembers", body: "Characters recur and adventures carry over. Tonight's brave fox returns next week, so Lullawood becomes a world your child can't wait to come back to.", art: "reason-remembers" },
  { title: "Engineered to wind down", body: "Every story follows a calming arc toward sleep — gentle energy, a soft resolution, characters settling in for the night. Built to bring the day down.", art: "reason-winddown" },
  { title: "Made to be read aloud", body: "Every story is written for a parent's voice at bedtime — an easy, calming read, so the screen stays in your hand and your child just listens.", art: "reason-listen" },
  { title: "Gentle lessons", body: "Set a quiet theme for the week — sharing, bravery, bedtime without a fuss — and we weave it in softly, the way the best stories always have.", art: "reason-lessons" },
  { title: "A world that grows with them", body: "Tonight's brave little fox returns next week. Characters and places recur and deepen, so Lullawood becomes a world your child knows by heart.", art: "reason-keepsake" },
];

export type Step = { n: string; title: string; body: string; art: string };
export const STEPS: Step[] = [
  { n: "One", title: "Tell us about your child", body: "Their name, the animals and worlds they love, a bedtime. Two minutes, once.", art: "how-1" },
  { n: "Two", title: "Open it at bedtime", body: "When it's time for bed, tonight's fresh story is ready and waiting — open Lullawood and read it aloud together.", art: "how-2" },
  { n: "Three", title: "They drift off as the hero", body: "The adventure ends, the characters fall asleep, and so does your child.", art: "how-3" },
];

export type Tier = {
  id: string; name: string; price: number; cadence: string; year: string;
  blurb: string; features: string[]; featured?: boolean;
};
export const TIERS: Tier[] = [
  { id: "dreamer", name: "Dreamer", price: 8.99, cadence: "/mo", year: "or $89.99/year", blurb: "One child, every night.", features: ["A new story nightly", "Recurring characters", "A consistent magical world", "Stories that remember"] },
  { id: "family", name: "Family", price: 12.99, cadence: "/mo", year: "or $129.99/year", blurb: "Up to four children.", features: ["Everything in Dreamer", "Up to 4 child profiles", "Sibling co-star mode", "Per-child bedtimes"], featured: true },
];

// Testimonials: REAL words from REAL test families only. Placeholder until then.
export type Testimonial = { quote: string; name: string; detail: string; initials: string; stars: number };
export const TESTIMONIALS: Testimonial[] = [
  { quote: "Bedtime used to be a fight. We tried a few of the sample stories and now my four-year-old asks if we can \u201Cgo to Lullawood\u201D before bed. That alone is worth it.",
    name: "Sarah M.", detail: "Mum of two (4 & 7)", initials: "SM", stars: 5 },
  { quote: "What got me wasn\u2019t seeing Oliver\u2019s name in the story \u2014 it was how settled he was by the end of it. He actually wound down instead of getting a second wind.",
    name: "James & Emily R.", detail: "Parents of Oliver (5)", initials: "JR", stars: 5 },
  { quote: "They read like proper bedtime books, not something a computer churned out. Beautifully written \u2014 my three all went quiet, which never happens.",
    name: "Hannah L.", detail: "Mum of three", initials: "HL", stars: 5 },
  { quote: "I travel a lot, so I tried recording one of the sample stories in my own voice for Ava. Being able to still do our story when I\u2019m away meant more to me than I expected.",
    name: "Michael T.", detail: "Dad of Ava (6)", initials: "MT", stars: 5 },
  { quote: "Fern and Bramble have somehow become part of our house already. My daughter talks about them like they\u2019re real.",
    name: "Rachel K.", detail: "Parent", initials: "RK", stars: 5 },
  { quote: "We did the samples screen-free, just curled up together. Ten minutes, but it\u2019s the kind of thing I think they\u2019ll actually remember.",
    name: "Daniel & Sophie W.", detail: "Parents of two", initials: "DW", stars: 5 },
];

// Founder story — placeholder for Stephen's TRUE story to be finalized.
export const ABOUT = {
  eyebrow: "Why I built Lullawood",
  heading: "A father, a bedtime, and the stories I still remember.",
  body: [
    "I still remember being read to as a child — the lamp, the voice, the feeling of being the most important person in the room for ten quiet minutes before sleep.",
    "Years later, with two sons of my own and a life that never seemed to slow down, I kept reaching for the same tired books at 7:58pm, half-asleep myself. I wanted them to have what I remembered: a story that was truly theirs, every night, that I didn't have to invent on the spot.",
    "So I built Lullawood. Every night it writes my boys into their own adventure — and now yours, too.",
  ],
  signature: "— Stephen, founder of Lullawood",
  caption: "The three of us, in Lullawood style.",
};

export type Faq = { q: string; a: string };
export const FAQS: Faq[] = [
  { q: "Who writes the stories — and is it safe?", a: "Stories are generated by AI and passed through safety filters before they ever reach your child, then shaped by the profile and themes you control. We're open about the technology because you deserve to know exactly what your child is hearing. Nothing scary, nothing inappropriate — gentle by design." },
  { q: "What ages is Lullawood for?", a: "It's tuned for roughly ages 2 to 8. You set your child's age and we adjust vocabulary, length, and tone to match." },
  { q: "Is this just more screen time?", a: "The opposite. Stories are written to be read aloud by you at bedtime — the screen stays in your hand, and your child just listens in the dark." },
  { q: "Can I cancel anytime?", a: "Yes. Every plan starts with a 7-day free trial and cancels in a click — no calls, no friction." },
  { q: "What happens after the free trial?", a: "Your first 7 days are completely free. If you keep going, your plan begins at the price you chose and renews until you cancel. You can cancel any time in a click — and there's no charge if you cancel before day seven." },
  { q: "Is my payment secure?", a: "Yes. All payments are handled by Stripe, the same secure provider trusted by millions of businesses worldwide. Your card details go straight to Stripe over an encrypted connection — Lullawood never sees or stores your full card number." },
  { q: "How do I get the stories?", a: "Each evening, your child's new story is ready and waiting in Lullawood — just open it at bedtime and read it aloud together. Every story is yours to keep in your child's growing library." },
  { q: "How does \"Lullawood remembers\" work?", a: "Each child has their own private story world. Characters and adventures carry over night to night, so the stories build into one ongoing saga rather than disconnected one-offs." },
  { q: "Do you keep my child's data private?", a: "Your child's profile is used only to write their stories. We never sell data, and you can delete a profile and everything tied to it at any time. See our Privacy Policy for the full detail." },
];


export type Place = { name: string; art: string; blurb: string };
export const WORLD: Place[] = [
  { name: "Story Oak", art: "world-storyoak", blurb: "The great oak whose roots cradle a glowing book — the heart of every Lullawood night." },
  { name: "Lantern Village", art: "world-lanternvillage", blurb: "Cottages among the trees, warm windows and wooden bridges, where the friends all live." },
  { name: "Moon Lake", art: "world-moonlake", blurb: "Still water under an enormous moon. The place that makes you breathe more slowly." },
  { name: "Whispering Woods", art: "world-whisperingwoods", blurb: "Ancient trees, glowing mushrooms and tiny lanterns. Beautiful, never frightening." },
  { name: "Star Harbor", art: "world-starharbor", blurb: "Little boats beneath the stars, lanterns on the water, a lighthouse keeping watch." },
  { name: "Dream Meadow", art: "world-dreammeadow", blurb: "Where stories end before children wake — dawn light, wildflowers, absolute peace." },
];

export type Friend = { name: string; role: string; art: string };
export const CHARACTERS: Friend[] = [
  { name: "Fern", role: "The Fox — kind, curious, welcomes every child", art: "char-fern" },
  { name: "Oliver", role: "The Owl — wise keeper of bedtime tales", art: "char-oliver" },
  { name: "Willow", role: "The Rabbit — gentle, brave, carries the lantern", art: "char-willow" },
  { name: "Bramble", role: "The Bear — loyal protector, loves warm cocoa", art: "char-bramble" },
  { name: "Nimbus", role: "The Dragon — tiny, shy, a little spark of magic", art: "char-nimbus" },
  { name: "Waverley", role: "The Whale — calm, kind, storyteller of the deep", art: "char-waverley" },
  { name: "Linden", role: "The Lion — brave guardian who stands up for what's right", art: "char-linden" },
  { name: "Luna", role: "The Unicorn — keeper of dreams and starlight", art: "char-luna" },
];

export const FINAL = {
  headline: "A story they'll remember long after they outgrow bedtime.",
  cta: "Write their first story free",
};
