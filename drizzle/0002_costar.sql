-- Co-star mode (Family tier): siblings can share one adventure.
-- Safe to run more than once (IF NOT EXISTS).

-- A co-star story is saved to BOTH children; each row points at the other child,
-- and both rows share a shared_story_id linking the pair.
ALTER TABLE stories  ADD COLUMN IF NOT EXISTS co_star_child_id text;
ALTER TABLE stories  ADD COLUMN IF NOT EXISTS shared_story_id  text;

-- A child's preferred sibling for the weekly (Friday) nightly co-star run.
ALTER TABLE children ADD COLUMN IF NOT EXISTS co_star_preference text;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'stories' AND column_name IN ('co_star_child_id','shared_story_id');
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'children' AND column_name = 'co_star_preference';
