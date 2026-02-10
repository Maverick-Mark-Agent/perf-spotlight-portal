-- =====================================================
-- CHECK CRON JOB STATUS FOR sync-daily-kpi-metrics
-- =====================================================

-- 1. Check if the cron job is scheduled
SELECT
  jobid,
  schedule,
  active,
  jobname,
  database,
  username,
  command
FROM cron.job
WHERE jobname = 'daily-kpi-metrics-sync';

-- 2. Check recent execution history
SELECT
  run.jobid,
  run.runid,
  run.status,
  run.return_message,
  run.start_time,
  run.end_time,
  EXTRACT(EPOCH FROM (run.end_time - run.start_time)) AS duration_seconds
FROM cron.job_run_details run
JOIN cron.job j ON j.jobid = run.jobid
WHERE j.jobname = 'daily-kpi-metrics-sync'
ORDER BY run.start_time DESC
LIMIT 20;

-- 3. Check all cron jobs (to see what else is running)
SELECT
  jobid,
  schedule,
  active,
  jobname,
  database
FROM cron.job
ORDER BY jobid;

-- 4. Check if pg_cron and pg_net extensions are enabled
SELECT
  extname,
  extversion
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net');
