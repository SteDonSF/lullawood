import { pgTable, uuid, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const parents = pgTable("parents", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan").default("trial").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const children = pgTable("children", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id").references(() => parents.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  age: integer("age"),
  animals: jsonb("animals").$type<string[]>().default([]),
  colors: jsonb("colors").$type<string[]>().default([]),
  interests: jsonb("interests").$type<string[]>().default([]),
  weeklyTheme: text("weekly_theme"),
  bedtimeHour: integer("bedtime_hour").default(19),   // local hour, 0-23
  timezone: text("timezone").default("UTC"),
  // The "story bible" — what makes Lullawood remember.
  recurringCharacters: jsonb("recurring_characters").$type<string[]>().default([]),
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
