-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the scheduled sync edge function
CREATE OR REPLACE FUNCTION public.trigger_scheduled_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text := current_setting('app.settings.supabase_url', true);
  service_key text := current_setting('app.settings.service_key', true);
  response text;
BEGIN
  -- Call the edge function via HTTP
  SELECT content INTO response
  FROM http((
    'POST',
    supabase_url || '/functions/v1/scheduled-sync-leads',
    ARRAY[http_header('Authorization', 'Bearer ' || service_key)],
    'application/json',
    '{}'
  )::http_request);

  RAISE NOTICE 'Scheduled sync completed: %', response;
END;
$$;

-- Schedule the sync to run every hour
-- Cron format: minute hour day month day_of_week
-- This runs at the top of every hour
SELECT cron.schedule(
  'hourly-lead-sync',
  '0 * * * *',  -- Every hour at minute 0
  'SELECT public.trigger_scheduled_sync();'
);

-- Alternative: Run every 30 minutes (uncomment to use)
-- SELECT cron.schedule(
--   'half-hourly-lead-sync',
--   '0,30 * * * *',  -- Every 30 minutes
--   'SELECT public.trigger_scheduled_sync();'
-- );

-- View scheduled jobs
SELECT * FROM cron.job;

COMMENT ON FUNCTION public.trigger_scheduled_sync IS 'Triggers the scheduled sync edge function to sync leads from Email Bison';

-- Verify
SELECT 'Auto-sync scheduled successfully! Runs every hour.' as status;
