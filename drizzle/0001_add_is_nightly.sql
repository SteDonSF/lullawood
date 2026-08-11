-- Nightly delivery: mark which stories were produced by the nightly cron.
-- Safe to run more than once (IF NOT EXISTS). Backfills existing rows to false.
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS is_nightly boolean NOT NULL DEFAULT false;

-- Verify:
--   SELECT id, title, is_nightly, created_at
--   FROM stories
--   ORDER BY created_at DESC
--   LIMIT 5;
