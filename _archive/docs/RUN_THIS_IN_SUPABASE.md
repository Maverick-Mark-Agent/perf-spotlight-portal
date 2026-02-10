# 🚀 FIX EMAIL DASHBOARD - FINAL STEPS

## Current Status
- ✅ Burnt mailbox feature is **DEPLOYED** and **LIVE**
- ❌ Data is **46 days old** (last synced October 26, 2025)
- ⚠️  All automated sync attempts failed due to invalid service role key

## Why This Needs Manual Execution

I've attempted every automated approach:
1. ❌ Node.js with service role key → "Invalid API key"
2. ❌ curl with service role key → "Invalid JWT"
3. ❌ PostgreSQL psql → Not installed on your system
4. ❌ Supabase CLI → Requires access token (not configured)

**The service role key in your `.env` file is outdated/invalid.**

The only way to trigger the sync is through the Supabase dashboard, which has the correct credentials.

---

## ⚡ QUICK FIX (2 minutes)

### Step 1: Open Supabase SQL Editor
Click here: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

### Step 2: Copy & Paste This SQL

```sql
-- Enable extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Trigger immediate email sync
SELECT extensions.http_post(
  url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);
```

### Step 3: Click "RUN"

Wait 2-3 seconds. You should see a response.

### Step 4: Wait 3-5 Minutes

The sync processes 5,220 email accounts. This takes 3-5 minutes.

### Step 5: Refresh Dashboard

1. Go to: https://www.maverickmarketingllc.com/email-accounts
2. Hard refresh: **Cmd + Shift + R** (Mac) or **Ctrl + Shift + R** (Windows)
3. Check that "Last synced" shows recent time
4. Look for "Burnt Mailboxes" alert in Action Items

---

## 🔧 What This Does

The SQL command triggers the `hybrid-email-accounts-v2` Edge Function which:
1. Fetches all 5,220 email accounts from Email Bison API
2. Updates the `sender_emails_cache` table with current data
3. Refreshes the materialized view
4. Updates timestamps to show fresh data

---

## ✅ Expected Results

After the sync completes and you refresh:

1. **Timestamp updated**: "Last synced: A few minutes ago"
2. **Burnt mailbox alert appears**: Shows accounts with <0.4% reply rate
3. **Fresh data**: All metrics show current values
4. **Alert details**: Click the burnt mailbox alert to see affected accounts

---

## 🆘 Troubleshooting

### If SQL fails with "function http_post does not exist"
Run this first:
```sql
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
```

### If sync doesn't complete after 10 minutes
Check the Edge Function logs:
https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/hybrid-email-accounts-v2/logs

### If you still see old data after refresh
1. Clear browser cache completely
2. Try incognito/private window
3. Check that you hard-refreshed (Cmd+Shift+R, not just Cmd+R)

---

## 🔄 Set Up Automatic Syncing (Optional)

To prevent this from happening again, set up a cron job to sync every 30 minutes:

```sql
-- Remove existing cron job if exists
SELECT cron.unschedule('sync-email-accounts-every-30min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-email-accounts-every-30min'
);

-- Create new cron job
SELECT cron.schedule(
  'sync-email-accounts-every-30min',
  '*/30 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify cron job was created
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'sync-email-accounts-every-30min';
```

---

## 📊 Verify Data Freshness

After sync completes, run this to check:

```sql
SELECT
  MAX(last_synced_at) as last_sync_time,
  COUNT(*) as total_accounts,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/60, 1) as minutes_old
FROM sender_emails_cache
WHERE last_synced_at IS NOT NULL;
```

If `minutes_old` is less than 10, you're all set! ✅

---

## 🎯 Summary

**What's Working:**
- ✅ Burnt mailbox feature deployed and live
- ✅ Code is production-ready
- ✅ Alert system configured

**What Needs Fixing:**
- ❌ Data is 46 days stale
- ❌ Service role key in `.env` is invalid

**Solution:**
Run the SQL script above in Supabase SQL Editor to sync data immediately.

**Time Required:** 2 minutes to run + 3-5 minutes for sync = **~5-7 minutes total**
