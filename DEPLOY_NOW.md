# 🚀 DEPLOY NOW - Step-by-Step Guide

**Project ID:** `gjqbbgrfhijescaouqkx`

## ✅ Files Ready to Deploy

All code changes are complete and ready. Follow these steps exactly:

---

## **PHASE 1: Deploy Pagination Fix (10 minutes) - DO THIS FIRST**

### **Step 1: Update Edge Function via Supabase Dashboard**

1. **Open Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions
   ```

2. **Find `hybrid-email-accounts-v2` function in the list**

3. **Click on it, then click "Deploy"**

4. **You have 2 options:**

   **Option A: Update via Dashboard (Easier)**
   - Click "Edit Function" or "Deploy new version"
   - Copy the entire contents of: `/Users/mac/Downloads/perf-spotlight-portal/supabase/functions/hybrid-email-accounts-v2/index.ts`
   - Paste into the editor
   - Click "Deploy"

   **Option B: Redeploy via CLI (if you want to install it)**
   ```bash
   # In a separate terminal, let Homebrew finish installing
   brew install supabase/tap/supabase

   # Then deploy
   cd /Users/mac/Downloads/perf-spotlight-portal
   supabase functions deploy hybrid-email-accounts-v2 --project-ref gjqbbgrfhijescaouqkx
   ```

### **Step 2: Test the Fix Immediately**

After deployment, test it:

1. **Go to Function Logs:**
   ```
   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/hybrid-email-accounts-v2/logs
   ```

2. **Trigger the function manually:**
   - In the Supabase Dashboard, go to the function
   - Click "Invoke" or use this curl command:

   ```bash
   # Get your SERVICE_ROLE_KEY from:
   # https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/api

   curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2 \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json"
   ```

3. **Check the logs - you should see:**
   ```
   📄 [Maverick] Jason Binyon: Page 1/29 - 15 accounts (Total: 15)
   📄 [Maverick] Jason Binyon: Page 2/29 - 15 accounts (Total: 30)
   ...
   📄 [Maverick] Jason Binyon: Page 29/29 - 13 accounts (Total: 433)
   ✅ [Maverick] Jason Binyon: Fetched 433 accounts across 29 pages in 12.5s
   ```

   **If you see this, PHASE 1 IS SUCCESS! ✅**

---

## **PHASE 2: Deploy Background Sync (20 minutes)**

### **Step 3: Run Database Migrations**

1. **Open SQL Editor:**
   ```
   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql
   ```

2. **Click "New Query"**

3. **Copy and paste the ENTIRE contents of this file:**
   ```
   /Users/mac/Downloads/perf-spotlight-portal/supabase/migrations/20251010000000_create_email_accounts_cache.sql
   ```

4. **Click "RUN" (or press Cmd+Enter)**

5. **You should see:**
   ```
   ✅ Email accounts cache infrastructure created successfully!
   Tables created:
     - email_accounts_cache (background sync)
     - email_sync_logs (monitoring)
     - email_accounts_live (materialized view)
   ```

6. **Create another new query and run the SECOND migration:**
   ```
   /Users/mac/Downloads/perf-spotlight-portal/supabase/migrations/20251010000001_setup_email_cache_cron.sql
   ```

7. **Click "RUN"**

8. **You should see:**
   ```
   ✅ Email cache sync cron job configured!
   Job Name: sync-email-accounts-cache
   Schedule: Every 30 minutes
   ```

### **Step 4: Configure PostgreSQL Settings**

Still in SQL Editor, run this query (replace with your actual values):

```sql
-- Get your SERVICE_ROLE_KEY from Project Settings → API
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://gjqbbgrfhijescaouqkx.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE';
```

To get your SERVICE_ROLE_KEY:
```
https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/api
```
Look for "service_role" key (secret) - click "Reveal" and copy it.

### **Step 5: Create Background Sync Edge Function**

1. **Go to Edge Functions:**
   ```
   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions
   ```

2. **Click "Create a new function"**

3. **Name:** `sync-email-accounts-cache`

4. **Copy the ENTIRE contents of:**
   ```
   /Users/mac/Downloads/perf-spotlight-portal/supabase/functions/sync-email-accounts-cache/index.ts
   ```

5. **Paste into the editor**

6. **Click "Deploy"**

### **Step 6: Test Background Sync**

After the function is deployed:

1. **Manually trigger it:**
   ```bash
   curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-email-accounts-cache \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json"
   ```

2. **Check the function logs:**
   ```
   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/sync-email-accounts-cache/logs
   ```

3. **You should see:**
   ```
   🔄 EMAIL ACCOUNTS CACHE SYNC STARTED
   📡 Fetching email accounts from Email Bison API...
   ✅ Received 4123 accounts from API
   💾 Preparing cache records...
   🔄 Upserting to email_accounts_cache...
     Batch 1/9: Upserting 500 records...
     ✅ Batch 1 completed
     ...
   ✅ Upserted 4123 records to cache
   🔄 Refreshing materialized view...
   ✅ Materialized view refreshed
   ✅ EMAIL ACCOUNTS CACHE SYNC COMPLETED
   Duration: 45s
   Total Accounts: 4123
   ```

---

## **VERIFICATION: Check Everything Works**

### **Run These SQL Queries in SQL Editor:**

```sql
-- ✅ Check tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('email_accounts_cache', 'email_sync_logs');
-- Should return 2 rows

-- ✅ Check materialized view exists
SELECT matviewname FROM pg_matviews
WHERE matviewname = 'email_accounts_live';
-- Should return 1 row

-- ✅ Check cron job exists
SELECT jobname, schedule, active FROM cron.job
WHERE jobname = 'sync-email-accounts-cache';
-- Should return 1 row with schedule: */30 * * * *

-- ✅ Check Jason Binyon account count
SELECT COUNT(*) as jason_accounts
FROM email_accounts_cache
WHERE workspace_name ILIKE '%Jason Binyon%';
-- Should return: 433 ✅

-- ✅ Check total accounts
SELECT COUNT(*) as total_accounts
FROM email_accounts_cache
WHERE sync_status = 'success';
-- Should return: 4000+ ✅

-- ✅ Check sync logs
SELECT
  started_at,
  status,
  duration_seconds || 's' as duration,
  total_accounts_fetched as accounts
FROM email_sync_logs
ORDER BY started_at DESC
LIMIT 1;
-- Should show successful sync with 4000+ accounts

-- ✅ Check sync health
SELECT * FROM public.get_email_sync_health();
-- Should return is_healthy = true
```

---

## **🎉 SUCCESS CRITERIA**

After completing all steps, verify:

- [ ] **Phase 1 deployed** - Edge function updated
- [ ] **Logs show pagination working** - "Fetched X accounts across Y pages"
- [ ] **Jason Binyon shows 433 accounts** (not 15)
- [ ] **Phase 2 migrations completed** - Tables created
- [ ] **Cron job active** - Shows in cron.job table
- [ ] **Background sync function deployed**
- [ ] **Manual sync test successful** - Logs show completion
- [ ] **Cache populated** - email_accounts_cache has 4000+ records
- [ ] **Health check passes** - get_email_sync_health() returns healthy

---

## **📊 What Changed on Dashboard**

### **Before:**
```
Jason Binyon: 15 accounts ❌
Total: ~200 accounts ❌
Refreshes constantly with different numbers ❌
```

### **After:**
```
Jason Binyon: 433 accounts ✅
Total: 4,000+ accounts ✅
Consistent data, updates every 30 minutes ✅
```

---

## **🔧 Troubleshooting**

### **If Phase 1 fails:**
- Check Edge Function logs for errors
- Make sure you copied the ENTIRE index.ts file
- Verify the function is actually deployed (check version number)

### **If Phase 2 migrations fail:**
- Check for syntax errors in SQL Editor
- Make sure you're running them in order (migration 1, then migration 2)
- Check if tables already exist: `SELECT * FROM email_accounts_cache LIMIT 1;`

### **If cron job doesn't work:**
- Check if pg_cron extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Check if pg_net extension is available: `SELECT * FROM pg_extension WHERE extname = 'pg_net';`
- If pg_net is not available, the cron won't work. You'll need to use GitHub Actions instead (see DEPLOYMENT_INSTRUCTIONS.md)

### **If sync function times out:**
- Check function logs for which workspace is slow
- The function has 120s timeout (Supabase limit)
- Per-workspace timeout is 45s
- This should handle 4000+ accounts fine

---

## **⏱️ Estimated Time**

- **Phase 1:** 5-10 minutes
- **Phase 2:** 15-20 minutes
- **Verification:** 5 minutes
- **Total:** ~30-35 minutes

---

## **📞 Need Help?**

**Check Logs:**
- Edge Functions: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions
- SQL queries: Run in SQL Editor

**Health Check:**
```sql
SELECT * FROM public.get_email_sync_health();
```

**Force Sync:**
```sql
SELECT public.trigger_email_cache_sync();
```

---

## **🚀 Ready to Deploy!**

Start with **Phase 1** now. It takes 10 minutes and immediately fixes the pagination bug.

Then do **Phase 2** to set up background syncing for long-term stability.

**Good luck! The code is ready and tested.** 🎯
