-- First-touch UTM attribution on the parent (auth `user`) row.
-- Safe to run more than once (IF NOT EXISTS).
--
-- NOTE: "user" is a reserved word in Postgres — the quotes are required.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS signup_source   text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS signup_campaign text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS signup_landing  text;

-- Backfill: everyone who signed up before this shipped is unattributable, and
-- that is a fact worth recording — it keeps 'pre-tracking' distinct from a NULL
-- that would otherwise read as "we tracked this and found nothing".
-- Run this in the SAME session as the ALTERs above, before any new signups
-- land; it is guarded on IS NULL and would otherwise also stamp real rows that
-- the app has not written to yet.
UPDATE "user" SET signup_source = 'pre-tracking' WHERE signup_source IS NULL;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'user'
--     AND column_name IN ('signup_source','signup_campaign','signup_landing');
--   SELECT signup_source, count(*) FROM "user" GROUP BY 1 ORDER BY 2 DESC;
