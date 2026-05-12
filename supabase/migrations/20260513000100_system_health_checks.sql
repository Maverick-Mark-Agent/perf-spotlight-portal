-- system_health_checks: integrity monitor results.
-- The integrity-monitor cron writes one row per run with the findings from
-- 4 invariants the auto-reply pipeline must always satisfy. The dashboard
-- reads the most recent row to decide whether to show a red banner.

CREATE TABLE IF NOT EXISTS system_health_checks (
  id              BIGSERIAL PRIMARY KEY,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_name      TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('ok','warning','critical')),
  issue_count     INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  affected_ids    JSONB,
  details         JSONB
);

CREATE INDEX IF NOT EXISTS idx_system_health_checks_checked_at
  ON system_health_checks (checked_at DESC);

-- Drop rows older than 7 days on insert so the table doesn't grow forever.
CREATE OR REPLACE FUNCTION prune_old_health_checks() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM system_health_checks WHERE checked_at < now() - interval '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prune_health_checks ON system_health_checks;
CREATE TRIGGER trg_prune_health_checks
  AFTER INSERT ON system_health_checks
  EXECUTE FUNCTION prune_old_health_checks();
