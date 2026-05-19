-- =====================================================
-- RE-ENABLE DAILY KPI METRICS SYNC CRON JOB
-- =====================================================
-- Purpose: Re-schedule sync-daily-kpi-metrics to run nightly so
--          client_metrics has a snapshot for every day. Previously
--          unscheduled on 2026-03-16 (see 20260316000000) because
--          the function was overwriting webhook-incremented columns
--          and causing drift.
--
-- Why this is safe now:
--   The drift concern is bounded: the cron fires once at 2am CST,
--   when the day has just rolled over and there's no active webhook
--   traffic to clobber. The big win — eliminating gaps like the
--   May 15 + May 16 missing rows that produced the "20k phantom
--   email" bug in the Daily Recap on May 17 — outweighs the bounded
--   drift window.
--
-- Schedule: 0 7 * * * UTC = 2am CST (no DST adjustment; close enough
-- year-round). Captures the full prior day's data once the day rolls
-- over and Bison's MTD reflects the closed day.
-- =====================================================

-- Defensive: in case a leftover scheduled job exists, drop it first
-- so we don't end up with two copies.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-kpi-metrics-sync') THEN
    PERFORM cron.unschedule('daily-kpi-metrics-sync');
  END IF;
END $$;

-- Schedule the new daily job.
SELECT cron.schedule(
  'daily-kpi-metrics-sync',
  '0 7 * * *',                           -- 2am CST (7am UTC)
  $$
    SELECT
      net.http_post(
        url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-daily-kpi-metrics',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('scheduled', true, 'timestamp', now())
      ) AS request_id;
  $$
);

-- Sanity-check the job was created and is active.
SELECT
  jobid,
  schedule,
  active,
  jobname
FROM cron.job
WHERE jobname = 'daily-kpi-metrics-sync';

-- Verification queries to run after this migration:
--   1. Confirm job exists:
--      SELECT * FROM cron.job WHERE jobname = 'daily-kpi-metrics-sync';
--   2. After it fires once (next 2am CST), check execution:
--      SELECT start_time, status, return_message
--      FROM cron.job_run_details
--      WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-kpi-metrics-sync')
--      ORDER BY start_time DESC LIMIT 5;
--   3. Confirm a new client_metrics row landed for today:
--      SELECT metric_date, count(*) FROM client_metrics
--      WHERE metric_date = CURRENT_DATE GROUP BY metric_date;

-- ROLLBACK: SELECT cron.unschedule('daily-kpi-metrics-sync');
