-- =====================================================
-- SCHEDULE DAILY KPI METRICS SYNC
-- =====================================================
-- Purpose: Automatically run sync-daily-kpi-metrics Edge Function daily at 12:01 AM
-- Uses: pg_cron extension
--
-- This ensures client_metrics table stays fresh with MTD data
-- =====================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the job to run daily at 12:01 AM (1 minute after midnight)
-- Using cron.schedule which returns a job ID
SELECT cron.schedule(
  'daily-kpi-metrics-sync',              -- job name
  '1 0 * * *',                           -- cron expression: 12:01 AM every day
  $$
    -- Call the sync-daily-kpi-metrics Edge Function
    SELECT
      net.http_post(
        url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-daily-kpi-metrics',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('scheduled', true, 'timestamp', now())
      ) as request_id;
  $$
);

-- Alternative: If you want to run as HTTP request, ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant execute permissions
GRANT USAGE ON SCHEMA net TO postgres;

-- =====================================================
-- MANUAL TESTING
-- =====================================================
-- To manually test the schedule (don't wait for midnight):
--
-- SELECT cron.schedule(
--   'test-kpi-sync-now',
--   '* * * * *',  -- Every minute for testing
--   $$ SELECT net.http_post(...) $$
-- );
--
-- Then check cron.job_run_details:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- To unschedule:
-- SELECT cron.unschedule('test-kpi-sync-now');
-- =====================================================

-- Add job execution history view for monitoring
CREATE OR REPLACE VIEW cron.daily_kpi_sync_history AS
SELECT
  run.jobid,
  run.runid,
  run.job_pid,
  run.database,
  run.username,
  run.command,
  run.status,
  run.return_message,
  run.start_time,
  run.end_time,
  EXTRACT(EPOCH FROM (run.end_time - run.start_time)) AS duration_seconds
FROM cron.job_run_details run
JOIN cron.job j ON j.jobid = run.jobid
WHERE j.jobname = 'daily-kpi-metrics-sync'
ORDER BY run.start_time DESC
LIMIT 30;

-- Grant access to view
GRANT SELECT ON cron.daily_kpi_sync_history TO postgres;

COMMENT ON VIEW cron.daily_kpi_sync_history IS 'Shows execution history for daily KPI metrics sync job (last 30 runs)';

-- Verify the job was created
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'daily-kpi-metrics-sync';

-- Success message
SELECT 'Daily KPI sync job scheduled successfully! Will run at 12:01 AM daily.' AS status;
