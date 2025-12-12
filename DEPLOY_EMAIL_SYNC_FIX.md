# Email Sync Fix - Copy & Paste Deployment Guide

## Problem
- Dashboard shows "Data is 46 days old"
- Email account data hasn't synced since October 26, 2025
- Burnt mailbox feature deployed but showing old data

## Solution
Run the SQL script below to:
1. Enable automatic syncing every 30 minutes
2. Trigger an immediate sync
3. Update all email account data

---

## Step 1: Open Supabase SQL Editor

Click this link: [Open SQL Editor](https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new)

---

## Step 2: Copy & Paste This SQL Script

```sql
-- =============================================================================
-- EMAIL SYNC FIX - Automated Setup
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Check current sync status
DO $$
DECLARE
  last_sync_time TIMESTAMP;
  hours_old NUMERIC;
BEGIN
  SELECT MAX(last_synced_at) INTO last_sync_time
  FROM sender_emails_cache
  WHERE last_synced_at IS NOT NULL;

  hours_old := EXTRACT(EPOCH FROM (NOW() - last_sync_time))/3600;

  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE 'CURRENT STATUS';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE 'Last Sync: %', last_sync_time;
  RAISE NOTICE 'Hours Old: %', ROUND(hours_old::NUMERIC, 1);
  RAISE NOTICE '═══════════════════════════════════════════';
END $$;

-- Remove existing cron job if exists
DO $$
BEGIN
  PERFORM cron.unschedule('sync-email-accounts-every-30min')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-email-accounts-every-30min'
  );
END $$;

-- Create cron job to sync every 30 minutes
SELECT cron.schedule(
  'sync-email-accounts-every-30min',
  '*/30 * * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/hybrid-email-accounts-v2',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    )::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify cron job was created
SELECT
  jobid,
  jobname,
  schedule,
  active,
  nodename
FROM cron.job
WHERE jobname = 'sync-email-accounts-every-30min';

-- Display success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '✅ CRON JOB SETUP COMPLETE!';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE 'Job Name: sync-email-accounts-every-30min';
  RAISE NOTICE 'Schedule: Every 30 minutes';
  RAISE NOTICE 'Status: Active';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEP:';
  RAISE NOTICE 'Run the IMMEDIATE SYNC script below to sync data NOW';
  RAISE NOTICE '═══════════════════════════════════════════';
END $$;
```

---

## Step 3: Click "RUN" Button

Wait for the script to complete (should take 2-3 seconds).

You should see output like:
```
NOTICE: ✅ CRON JOB SETUP COMPLETE!
```

---

## Step 4: Trigger Immediate Sync

Now copy & paste this second script to sync data immediately:

```sql
-- =============================================================================
-- TRIGGER IMMEDIATE SYNC - Run this AFTER the setup script above
-- =============================================================================

SELECT extensions.http_post(
  url := current_setting('app.settings.supabase_url', true) || '/functions/v1/hybrid-email-accounts-v2',
  headers := json_build_object(
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
    'Content-Type', 'application/json',
    'x-triggered-by', 'manual'
  )::jsonb,
  body := '{}'::jsonb
) AS sync_response;

-- Wait message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '⏳ SYNC TRIGGERED!';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE 'The sync is now running in the background.';
  RAISE NOTICE 'This will take 2-5 minutes for 4000+ accounts.';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Wait 3-5 minutes';
  RAISE NOTICE '2. Run the verification script below';
  RAISE NOTICE '═══════════════════════════════════════════';
END $$;
```

---

## Step 5: Wait 3-5 Minutes

The sync is processing in the background. Get a coffee ☕

---

## Step 6: Verify Sync Completed

After 3-5 minutes, run this verification script:

```sql
-- =============================================================================
-- VERIFY SYNC - Check if data was updated
-- =============================================================================

SELECT
  '✅ VERIFICATION' as status,
  MAX(last_synced_at) as last_sync_time,
  COUNT(*) as total_accounts,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/60, 1) as minutes_old
FROM sender_emails_cache
WHERE last_synced_at IS NOT NULL;

-- Success message
DO $$
DECLARE
  minutes_old NUMERIC;
BEGIN
  SELECT EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/60 INTO minutes_old
  FROM sender_emails_cache
  WHERE last_synced_at IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════';

  IF minutes_old < 10 THEN
    RAISE NOTICE '🎉 SUCCESS! Data is fresh (% minutes old)', ROUND(minutes_old, 1);
    RAISE NOTICE '';
    RAISE NOTICE 'FINAL STEPS:';
    RAISE NOTICE '1. Go to: https://www.maverickmarketingllc.com/email-accounts';
    RAISE NOTICE '2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)';
    RAISE NOTICE '3. Check "Last synced" shows recent time';
    RAISE NOTICE '4. Look for burnt mailbox alert';
  ELSE
    RAISE NOTICE '⏳ Still syncing (% minutes old)', ROUND(minutes_old, 1);
    RAISE NOTICE 'Wait 2 more minutes and run this script again.';
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════';
END $$;
```

---

## Step 7: Refresh Your Dashboard

1. Go to: https://www.maverickmarketingllc.com/email-accounts
2. Hard refresh your browser:
   - **Mac**: `Cmd + Shift + R`
   - **Windows**: `Ctrl + Shift + R`
3. Check that:
   - Timestamp shows "Last synced: A few minutes ago"
   - Burnt mailbox alert appears in "Action Items & Alerts"
   - All data is current

---

## Troubleshooting

### If "http_post" function doesn't exist:

Run this first:
```sql
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
```

### If sync doesn't complete after 10 minutes:

Check the Edge Function logs:
https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/hybrid-email-accounts-v2/logs

### If you get permission errors:

You may need to use the service role key instead of the anon key. Contact your Supabase admin.

---

## What This Does

✅ **Enables automatic sync** - Data will sync every 30 minutes automatically
✅ **Syncs immediately** - Gets fresh data right now
✅ **Updates dashboard** - Shows current email metrics
✅ **Activates burnt mailbox alert** - Shows accounts with <0.4% reply rate

---

## Questions?

If you encounter any issues, check:
1. Supabase Edge Function logs
2. SQL Editor error messages
3. Browser console for frontend errors

The burnt mailbox feature is deployed and ready - it just needs fresh data to work with!
