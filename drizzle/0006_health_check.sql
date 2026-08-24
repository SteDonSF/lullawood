-- Daily health check (/api/cron/health-check, fired by the lullawood-healthcheck
-- Worker at 14:00 UTC / 7am PT). Safe to run more than once (IF NOT EXISTS).
--
-- NOTE: api_events, metrics_daily and channel_spend already exist — they came in
-- with 0005_admin_metrics.sql. The health check READS those. The only new table
-- here is page_speed, which is not a request log: it's an outside-in measurement
-- of the public site, taken on a schedule.

CREATE TABLE IF NOT EXISTS page_speed (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path              text NOT NULL,                  -- '/' or '/try'
  strategy          text NOT NULL DEFAULT 'mobile',
  performance_score integer,                        -- Lighthouse 0-100
  lcp_ms            integer,                        -- Largest Contentful Paint
  tbt_ms            integer,                        -- Total Blocking Time
  ttfb_ms           integer,                        -- server response time
  created_at        timestamp NOT NULL DEFAULT now()
);

-- The dashboard reads "last 7 days, newest first"; the check reads today's run.
CREATE INDEX IF NOT EXISTS page_speed_created_idx ON page_speed (created_at DESC);
CREATE INDEX IF NOT EXISTS page_speed_path_created_idx ON page_speed (path, created_at DESC);

-- Verify:
--   SELECT to_regclass('page_speed');
--   SELECT path, performance_score, lcp_ms, created_at
--   FROM page_speed ORDER BY created_at DESC LIMIT 5;
