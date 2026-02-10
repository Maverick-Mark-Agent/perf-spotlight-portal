-- Manual Email Sync Fix
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Check current sync status
SELECT
  'Current Sync Status' as status,
  MAX(last_synced_at) as last_sync,
  COUNT(*) as total_accounts,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/3600 as hours_old
FROM sender_emails_cache
WHERE last_synced_at IS NOT NULL;

-- Step 3: Create helper function to trigger manual sync
CREATE OR REPLACE FUNCTION public.manual_trigger_email_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
  request_id bigint;
BEGIN
  -- Trigger the hybrid email accounts function
  SELECT INTO request_id
    net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/hybrid-email-accounts-v2',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Sync triggered successfully',
    'request_id', request_id,
    'note', 'Sync will complete in 2-5 minutes. Check sender_emails_cache table.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Step 4: Remove existing cron job if exists
SELECT cron.unschedule('sync-email-accounts-cache')
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname = 'sync-email-accounts-cache'
);

-- Step 5: Create cron job to run every 30 minutes
SELECT cron.schedule(
  'sync-email-accounts-cache',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/hybrid-email-accounts-v2',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json',
      'x-triggered-by', 'cron'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Step 6: Verify cron job was created
SELECT
  'Cron Job Status' as status,
  jobid,
  jobname,
  schedule,
  active,
  nodename
FROM cron.job
WHERE jobname = 'sync-email-accounts-cache';

-- Step 7: Trigger immediate sync (run this manually after setup)
-- Uncomment the line below to trigger an immediate sync:
-- SELECT public.manual_trigger_email_sync();

-- Instructions:
-- 1. Copy this entire SQL script
-- 2. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
-- 3. Paste and click "RUN"
-- 4. Wait for completion
-- 5. Then uncomment and run the last line to trigger immediate sync
-- 6. Wait 2-5 minutes
-- 7. Refresh your dashboard (Cmd+Shift+R)
