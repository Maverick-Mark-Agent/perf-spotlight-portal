-- ═══════════════════════════════════════════════════════════
-- SETUP EMAIL ACCOUNTS AUTOMATIC SYNC
-- ═══════════════════════════════════════════════════════════
-- This script sets up a cron job to automatically sync email
-- accounts every 30 minutes AND triggers an immediate sync.
-- ═══════════════════════════════════════════════════════════

-- Step 1: Ensure pg_cron and pg_net extensions are installed
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Remove any existing email sync cron jobs
DO $$
BEGIN
  -- Try to unschedule old jobs (will fail silently if they don't exist)
  PERFORM cron.unschedule('sync-email-accounts-every-30min');
  PERFORM cron.unschedule('email-accounts-sync');
  PERFORM cron.unschedule('sync-sender-emails');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Some old jobs may not exist (this is ok)';
END $$;

-- Step 3: Create new cron job (runs every 30 minutes)
SELECT cron.schedule(
  'email-accounts-sync-30min',
  '*/30 * * * *',  -- Every 30 minutes
  $$
    SELECT
      net.http_post(
        url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('scheduled', true, 'timestamp', now())
      ) as request_id;
  $$
);

-- Step 4: Verify the cron job was created
SELECT
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'email-accounts-sync-30min';

-- Step 5: Trigger IMMEDIATE sync right now
SELECT net.http_post(
  url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
  ),
  body := jsonb_build_object('manual', true, 'timestamp', now())
) AS immediate_sync_response;

-- Step 6: Display success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ EMAIL SYNC CRON JOB CONFIGURED!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Automatic Sync: Every 30 minutes';
  RAISE NOTICE 'Immediate Sync: Triggered now';
  RAISE NOTICE '';
  RAISE NOTICE 'Wait 3-5 minutes for the sync to complete,';
  RAISE NOTICE 'then refresh your dashboard!';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
