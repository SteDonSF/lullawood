import { pgTable, uuid, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { user } from "../auth-schema";

// Re-export the auth user table so getDb()'s `import * as schema` sees it,
// letting the children -> user relation resolve in one Drizzle instance.
export { user };

// NOTE: The standalone `parents` table was removed. A logged-in parent IS the
// auth `user` row; children hang directly off user.id (one identity).
// Billing fields (plan, stripeCustomerId) move to a subscriptions table at the
// Stripe phase.

export const children = pgTable("children", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: text("parent_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  age: integer("age"),
  animals: jsonb("animals").$type<string[]>().default([]),
  colors: jsonb("colors").$type<string[]>().default([]),
  interests: jsonb("interests").$type<string[]>().default([]),
  // Progressive personalization (Phase 2): the free-text "living portrait"
  // the engine mines, plus the structured "never include" avoid-list.
  aboutText: text("about_text"),
  avoidList: jsonb("avoid_list").$type<string[]>().default([]),
  weeklyTheme: text("weekly_theme"),
  bedtimeHour: integer("bedtime_hour").default(19),   // local hour, 0-23
  timezone: text("timezone").default("UTC"),
  // The "story bible" — what makes Lullawood remember.
  recurringCharacters: jsonb("recurring_characters").$type<string[]>().default([]),
  // Co-star (Family tier): a preferred sibling to pair with on the weekly nightly
  // co-star run (Fridays). Stores the other child's id. Null = solo nightly.
  coStarPreference: text("co_star_preference"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stories = pgTable("stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  childId: uuid("child_id").references(() => children.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  summary: text("summary"),          // one-line, fed into tomorrow's prompt
  audioUrl: text("audio_url"),
  // True when produced by the nightly delivery cron (vs. an on-demand "write a
  // story now" from the dashboard). The dashboard's "tonight's story is ready"
  // state keys off this + createdAt (the generation time). Backfills false.
  isNightly: boolean("is_nightly").default(false).notNull(),
  // Co-star (Family tier): a sibling story is saved to BOTH children. Each row
  // points at the OTHER child, and both rows share a sharedStoryId so the pair
  // is linkable. Null for ordinary solo stories.
  coStarChildId: text("co_star_child_id"),
  sharedStoryId: text("shared_story_id"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const waitlist = pgTable("waitlist", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const demoEvents = pgTable("demo_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  ipHash: text("ip_hash"),
  childName: text("child_name"),
  animal: text("animal"),
  adventure: text("adventure"),
  color: text("color"),
  ok: boolean("ok").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  // One subscription per parent (the auth user). Billing identity that
  // replaced the dropped `parents` table's plan/stripeCustomerId fields.
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull().unique(),
  // Which plan: 'dreamer' | 'family' (mirrors the Stripe products).
  plan: text("plan"),
  // Stripe's truth — set/updated by the webhook, never by the browser.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  // Lifecycle status from Stripe: 'trialing' | 'active' | 'past_due' |
  // 'canceled' | 'incomplete' | etc. Gating reads this.
  status: text("status"),
  // When the current paid/trial period ends (for access checks + display).
  currentPeriodEnd: timestamp("current_period_end"),
  trialEnd: timestamp("trial_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  // Guards the trial-ending reminder cron so each parent is emailed once.
  trialReminderSent: boolean("trial_reminder_sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accessCodes = pgTable("access_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  label: text("label"),
  maxRedemptions: integer("max_redemptions").notNull().default(1),
  redemptionsUsed: integer("redemptions_used").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accessGrants = pgTable("access_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  codeId: uuid("code_id").references(() => accessCodes.id, { onDelete: "set null" }),
  source: text("source").notNull().default("reviewer"),
  plan: text("plan").notNull().default("family"),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============================================================================
// Product health — written by the daily health-check cron (/api/cron/health-check,
// fired by the lullawood-healthcheck Worker at 14:00 UTC / 7am PT).
// =============================================================================

// One row per page, per health-check run. The check ALERTS on a breach; this
// table is the history behind it, so /admin/dashboard can show the trend (last
// 7 days) rather than only the moment something broke.
export const pageSpeed = pgTable("page_speed", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Path measured, e.g. "/" or "/try".
  path: text("path").notNull(),
  // PageSpeed Insights strategy: 'mobile' | 'desktop'. We measure mobile —
  // that's where bedtime traffic actually is.
  strategy: text("strategy").notNull().default("mobile"),
  // Lighthouse performance category, 0-100 (null if the API returned no score).
  performanceScore: integer("performance_score"),
  // Core metrics, milliseconds. lcpMs = Largest Contentful Paint,
  // tbtMs = Total Blocking Time, ttfbMs = server response time.
  lcpMs: integer("lcp_ms"),
  tbtMs: integer("tbt_ms"),
  ttfbMs: integer("ttfb_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Lightweight request log — the raw material for the health check's error-rate
// and cron-health signals. Deliberately thin (no bodies, no PII): route, HTTP
// status, an outcome tag, duration, and a small jsonb for run counts. Written
// best-effort; a failed insert must never break a request.
export const apiEvents = pgTable("api_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  route: text("route").notNull(),
  status: integer("status").notNull(),
  // Short tag: 'ok' | 'rate_limited' | 'no_subscription' | 'error' | 'cron_run'.
  outcome: text("outcome"),
  durationMs: integer("duration_ms"),
  // Small structured extras (e.g. the nightly cron's {total,succeeded,failed}).
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
