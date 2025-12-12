-- Setup Cron Job for Email Accounts Cache Background Sync
-- Runs every 30 minutes to keep dashboard data fresh and consistent

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing cron job if it exists (for idempotency)
SELECT cron.unschedule('sync-email-accounts-cache')
WHERE jobid IN (
  SELECT jobid
  FROM cron.job
  WHERE jobname = 'sync-email-accounts-cache'
);

-- Create new cron job to run every 30 minutes
-- Cron expression: */30 * * * * = "At every 30th minute"
SELECT cron.schedule(
  'sync-email-accounts-cache',                           -- Job name
  '*/30 * * * *',                                        -- Cron expression (every 30 minutes)
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-email-accounts-cache',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json',
        'x-triggered-by', 'cron'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Alternative: Manual setup instructions if pg_net is not available
-- In that case, use external cron (like GitHub Actions, AWS EventBridge, etc.)
COMMENT ON EXTENSION pg_cron IS 'Cron-based job scheduler for PostgreSQL. Job: sync-email-accounts-cache runs every 30 minutes.';

-- Create helper function to manually trigger sync (for testing)
CREATE OR REPLACE FUNCTION public.trigger_email_cache_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
BEGIN
  -- Make HTTP request to sync function
  SELECT content::jsonb INTO response
  FROM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-email-accounts-cache',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json',
      'x-triggered-by', 'manual'
    ),
    body := '{}'::jsonb
  );

  RETURN response;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.trigger_email_cache_sync() IS
  'Manually trigger email accounts cache sync. Useful for testing or immediate refresh.';

-- Create helper function to check cron job status
CREATE OR REPLACE FUNCTION public.get_email_cache_cron_status()
RETURNS TABLE (
  job_id BIGINT,
  job_name TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    jobid,
    jobname,
    schedule,
    active,
    -- Estimate last run based on sync logs
    (SELECT started_at FROM email_sync_logs WHERE triggered_by = 'cron' ORDER BY started_at DESC LIMIT 1) AS last_run,
    -- Calculate next run based on schedule
    (SELECT started_at + INTERVAL '30 minutes' FROM email_sync_logs WHERE triggered_by = 'cron' ORDER BY started_at DESC LIMIT 1) AS next_run
  FROM cron.job
  WHERE jobname = 'sync-email-accounts-cache';
$$;

COMMENT ON FUNCTION public.get_email_cache_cron_status() IS
  'Check status of email cache sync cron job including last/next run times.';

-- Log successful setup
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'sync-email-accounts-cache';

  IF job_count > 0 THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Email cache sync cron job configured!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Job Name: sync-email-accounts-cache';
    RAISE NOTICE 'Schedule: Every 30 minutes (*/30 * * * *)';
    RAISE NOTICE 'Target: /functions/v1/sync-email-accounts-cache';
    RAISE NOTICE '';
    RAISE NOTICE 'Helper Functions:';
    RAISE NOTICE '  - trigger_email_cache_sync() - Manual trigger';
    RAISE NOTICE '  - get_email_cache_cron_status() - Check job status';
    RAISE NOTICE '';
    RAISE NOTICE 'Testing:';
    RAISE NOTICE '  SELECT public.trigger_email_cache_sync();';
    RAISE NOTICE '';
    RAISE NOTICE 'Monitoring:';
    RAISE NOTICE '  SELECT * FROM public.get_email_cache_cron_status();';
    RAISE NOTICE '  SELECT * FROM email_sync_logs ORDER BY started_at DESC LIMIT 5;';
    RAISE NOTICE '  SELECT * FROM public.get_email_sync_health();';
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING '⚠️  Failed to create cron job. Check pg_cron extension.';
  END IF;
END $$;
