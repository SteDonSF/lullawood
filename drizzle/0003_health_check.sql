-- Daily health check (/api/cron/health-check, fired by the lullawood-healthcheck
-- Worker at 14:00 UTC / 7am PT). Safe to run more than once (IF NOT EXISTS).

-- PageSpeed Insights history: one row per page, per run. The check alerts on a
-- breach; this table is the trend behind it (surfaced on /admin/dashboard).
CREATE TABLE IF NOT EXISTS page_speed (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path              text NOT NULL,
  strategy          text NOT NULL DEFAULT 'mobile',
  performance_score integer,
  lcp_ms            integer,
  tbt_ms            integer,
  ttfb_ms           integer,
  created_at        timestamp NOT NULL DEFAULT now()
);

-- The dashboard reads the last 7 days newest-first; the check reads today's run.
CREATE INDEX IF NOT EXISTS page_speed_created_at_idx ON page_speed (created_at DESC);

-- Thin request log — the raw material for the error-rate and cron-health checks.
-- No bodies, no PII: route, status, an outcome tag, duration, small jsonb meta.
CREATE TABLE IF NOT EXISTS api_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route       text NOT NULL,
  status      integer NOT NULL,
  outcome     text,
  duration_ms integer,
  meta        jsonb,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- Every health-check query is "this route, this time window".
CREATE INDEX IF NOT EXISTS api_events_route_created_at_idx ON api_events (route, created_at DESC);

-- Verify:
--   SELECT path, performance_score, lcp_ms, created_at FROM page_speed ORDER BY created_at DESC LIMIT 5;
--   SELECT route, status, outcome, created_at FROM api_events ORDER BY created_at DESC LIMIT 5;
