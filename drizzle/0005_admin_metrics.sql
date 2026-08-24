-- Admin dashboard: manual ad spend + a thin request log for product health.
-- Safe to run more than once (IF NOT EXISTS).

-- Ad spend, typed in monthly (Meta's API needs app review first).
-- Money in integer CENTS — never a float.
CREATE TABLE IF NOT EXISTS channel_spend (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,
  month        text NOT NULL,                 -- 'YYYY-MM'
  amount_cents integer NOT NULL DEFAULT 0,
  note         text,
  created_at   timestamp NOT NULL DEFAULT now(),
  updated_at   timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS channel_spend_source_month_idx
  ON channel_spend (source, month);

-- Thin request log behind the product-health panel: failures, 402s, 429s, and
-- a latency sample on success. Not a general access log.
CREATE TABLE IF NOT EXISTS api_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route       text NOT NULL,
  status      integer NOT NULL,
  duration_ms integer,
  user_id     text,
  detail      text,
  created_at  timestamp NOT NULL DEFAULT now()
);
-- Every product-health query filters on "last 24h", so lead with created_at.
CREATE INDEX IF NOT EXISTS api_events_created_idx ON api_events (created_at DESC);
CREATE INDEX IF NOT EXISTS api_events_route_status_idx ON api_events (route, status, created_at DESC);

-- Daily snapshot of the five health-strip numbers, written by the daily
-- trial-reminder cron. Turns the dashboard's 7-day averages from reconstructed
-- (inferred from subscription timestamps, blind to overwritten status history)
-- into measured. Keyed by day so a re-run overwrites instead of double-counting.
CREATE TABLE IF NOT EXISTS metrics_daily (
  day                  text PRIMARY KEY,        -- 'YYYY-MM-DD' (UTC)
  active_subscriptions integer NOT NULL DEFAULT 0,
  mrr_cents            integer NOT NULL DEFAULT 0,
  trials_in_flight     integer NOT NULL DEFAULT 0,
  stories_delivered    integer NOT NULL DEFAULT 0,
  failed_payments      integer NOT NULL DEFAULT 0,
  created_at           timestamp NOT NULL DEFAULT now()
);

-- Verify:
--   SELECT to_regclass('channel_spend'), to_regclass('api_events'), to_regclass('metrics_daily');
