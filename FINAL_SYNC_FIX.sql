-- ===================================================================
-- COMPLETE EMAIL SYNC FIX - All-in-One Script
-- ===================================================================
-- INSTRUCTIONS:
-- 1. Open: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
-- 2. Copy this ENTIRE file
-- 3. Paste into SQL Editor
-- 4. Click "RUN"
-- 5. Wait for completion
-- ===================================================================

-- Part 1: Enable Required Extensions
-- ===================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Part 2: Check Current Status
-- ===================================================================
DO $$
DECLARE
  last_sync TIMESTAMP;
  hours_old NUMERIC;
  account_count INTEGER;
BEGIN
  SELECT
    MAX(last_synced_at),
    EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/3600,
    COUNT(*)
  INTO last_sync, hours_old, account_count
  FROM sender_emails_cache
  WHERE last_synced_at IS NOT NULL;

  RAISE NOTICE '══════════════════════════════════════════════════════════';
  RAISE NOTICE 'CURRENT STATUS';
  RAISE NOTICE '══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total Accounts: %', account_count;
  RAISE NOTICE 'Last Sync: %', last_sync;
  RAISE NOTICE 'Age: % hours (% days)', ROUND(hours_old, 1), ROUND(hours_old/24, 1);
  RAISE NOTICE '══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Part 3: Remove Old Cron Job (if exists)
-- ===================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('sync-email-accounts-every-30min')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-email-accounts-every-30min'
  );

  PERFORM cron.unschedule('sync-email-accounts-cache')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-email-accounts-cache'
  );

  RAISE NOTICE 'Old cron jobs removed (if they existed)';
END $$;

-- Part 4: Create NEW Cron Job (Every 30 Minutes)
-- ===================================================================
SELECT cron.schedule(
  'sync-email-accounts-every-30min',
  '*/30 * * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/hybrid-email-accounts-v2',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json',
      'x-triggered-by', 'cron'
    )::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Part 5: Verify Cron Job Created
-- ===================================================================
DO $$
DECLARE
  job_count INTEGER;
  job_record RECORD;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'sync-email-accounts-every-30min';

  IF job_count > 0 THEN
    SELECT * INTO job_record
    FROM cron.job
    WHERE jobname = 'sync-email-accounts-every-30min';

    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ CRON JOB CREATED SUCCESSFULLY!';
    RAISE NOTICE '══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Job ID: %', job_record.jobid;
    RAISE NOTICE 'Job Name: %', job_record.jobname;
    RAISE NOTICE 'Schedule: % (every 30 minutes)', job_record.schedule;
    RAISE NOTICE 'Active: %', job_record.active;
    RAISE NOTICE '══════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: The cron job will run automatically.';
    RAISE NOTICE '   First run will happen within 30 minutes.';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 TO SYNC IMMEDIATELY: Run the TRIGGER SYNC script below';
    RAISE NOTICE '══════════════════════════════════════════════════════════';
  ELSE
    RAISE WARNING '❌ Cron job creation failed!';
    RAISE WARNING 'Check if pg_cron extension is enabled';
  END IF;
END $$;

-- ===================================================================
-- SETUP COMPLETE!
-- ===================================================================
-- Next step: Run the script below to trigger an immediate sync
-- (Don't wait 30 minutes for the cron job)
-- ===================================================================
