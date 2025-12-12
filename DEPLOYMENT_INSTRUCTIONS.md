# 🚀 Deployment Instructions - Email Dashboard Fix

## ⚡ Quick Deploy Commands

Since Supabase CLI isn't installed locally, you have two options:

---

## **Option 1: Deploy via Supabase Dashboard (Recommended)**

### **Step 1: Deploy Phase 1 - Pagination Fix (5 minutes)**

#### **1.1 Deploy hybrid-email-accounts-v2 Edge Function**

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions
2. Click on `hybrid-email-accounts-v2` function
3. Click **"Deploy New Version"**
4. Upload the file: `supabase/functions/hybrid-email-accounts-v2/index.ts`
5. Click **"Deploy"**

**OR use the Supabase CLI if available:**
```bash
# Install Supabase CLI first (if not installed)
npm install -g supabase

# Deploy the function
cd /Users/mac/Downloads/perf-spotlight-portal
supabase functions deploy hybrid-email-accounts-v2
```

#### **1.2 Test the Fix**

Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions/hybrid-email-accounts-v2/logs

Then trigger manually:
```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/hybrid-email-accounts-v2 \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Look for logs like:**
```
✅ [Maverick] Jason Binyon: Fetched 433 accounts across 29 pages in 12.5s
```

---

### **Step 2: Deploy Phase 2 - Background Sync (30 minutes)**

#### **2.1 Run Database Migrations**

**Via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
2. Create a new query
3. Copy the contents of: `supabase/migrations/20251010000000_create_email_accounts_cache.sql`
4. Click **"Run"**
5. Verify success message

**Then run the second migration:**
1. Create another new query
2. Copy the contents of: `supabase/migrations/20251010000001_setup_email_cache_cron.sql`
3. Click **"Run"**
4. Verify cron job created

**OR use CLI:**
```bash
supabase db push
```

#### **2.2 Configure PostgreSQL Settings**

**Via Supabase Dashboard SQL Editor:**
```sql
-- Replace with your actual values
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_ID.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

To get these values:
- **SUPABASE_URL**: Go to Project Settings → API → Project URL
- **SERVICE_ROLE_KEY**: Go to Project Settings → API → service_role key (secret)

#### **2.3 Create sync-email-accounts-cache Edge Function**

**Via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions
2. Click **"Create a new function"**
3. Name: `sync-email-accounts-cache`
4. Upload file: `supabase/functions/sync-email-accounts-cache/index.ts`
5. Click **"Create function"**

**OR use CLI:**
```bash
supabase functions deploy sync-email-accounts-cache
```

#### **2.4 Test Background Sync**

**Manually trigger sync:**
```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/sync-email-accounts-cache \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Check logs in Dashboard:**
Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions/sync-email-accounts-cache/logs

Look for:
```
✅ EMAIL ACCOUNTS CACHE SYNC COMPLETED
Duration: 45s
Total Accounts: 4123
```

---

## **Option 2: Install Supabase CLI and Deploy (Faster)**

### **2.1 Install Supabase CLI**

```bash
# macOS
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

### **2.2 Login to Supabase**

```bash
supabase login
```

### **2.3 Link to Your Project**

```bash
cd /Users/mac/Downloads/perf-spotlight-portal
supabase link --project-ref YOUR_PROJECT_ID
```

### **2.4 Deploy Everything**

```bash
# Deploy Phase 1 - Pagination fix
supabase functions deploy hybrid-email-accounts-v2

# Deploy Phase 2 - Database migrations
supabase db push

# Deploy Phase 2 - Background sync function
supabase functions deploy sync-email-accounts-cache
```

### **2.5 Configure Settings**

Run this SQL in the Supabase Dashboard SQL Editor:
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_ID.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

### **2.6 Test Everything**

```bash
# Test pagination fix
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/hybrid-email-accounts-v2 \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# Test background sync
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/sync-email-accounts-cache \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## **Verification Checklist**

After deployment, run these SQL queries in Supabase Dashboard:

```sql
-- ✅ Check tables created
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('email_accounts_cache', 'email_sync_logs');

-- ✅ Check materialized view created
SELECT matviewname FROM pg_matviews
WHERE matviewname = 'email_accounts_live';

-- ✅ Check cron job exists
SELECT * FROM cron.job WHERE jobname = 'sync-email-accounts-cache';

-- ✅ Manually trigger sync and check results
SELECT public.trigger_email_cache_sync();

-- ✅ Check sync logs
SELECT * FROM email_sync_logs ORDER BY started_at DESC LIMIT 1;

-- ✅ Verify Jason Binyon account count
SELECT COUNT(*) as jason_accounts
FROM email_accounts_cache
WHERE workspace_name ILIKE '%Jason Binyon%';
-- Should return: 433

-- ✅ Check sync health
SELECT * FROM public.get_email_sync_health();
```

---

## **Expected Results**

### **After Phase 1 Deployment:**
- ✅ Jason Binyon shows 433 accounts (was 15)
- ✅ All workspaces show complete account counts
- ✅ Enhanced logs with page counts and timing

### **After Phase 2 Deployment:**
- ✅ Background sync runs every 30 minutes
- ✅ Dashboard data is consistent
- ✅ Full audit logs in `email_sync_logs` table
- ✅ Health monitoring available

---

## **Troubleshooting**

### **Issue: pg_net extension not available**

The cron job requires `pg_net` extension. Check if it's available:
```sql
SELECT * FROM pg_available_extensions WHERE name = 'pg_net';
```

If not available, you'll need to use an external cron (like GitHub Actions):

**Create `.github/workflows/sync-email-cache.yml`:**
```yaml
name: Sync Email Accounts Cache
on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:  # Allow manual trigger
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Background Sync
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/sync-email-accounts-cache \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

### **Issue: Function timeout**

If sync takes too long:
1. Check which workspaces are slow:
```sql
SELECT workspace_name, COUNT(*)
FROM email_accounts_cache
GROUP BY workspace_name
ORDER BY COUNT(*) DESC;
```

2. Increase timeout in Edge Function settings (max 120s for Supabase free tier)

### **Issue: Cron job not running**

Check cron job status:
```sql
SELECT * FROM cron.job WHERE jobname = 'sync-email-accounts-cache';

-- Check if it's active
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'sync-email-accounts-cache';
```

Manually run the HTTP call:
```sql
SELECT public.trigger_email_cache_sync();
```

---

## **Quick Reference: Your Project Info**

Fill these in for easy reference:

```
Project ID: _________________
Supabase URL: https://_________________.supabase.co
Service Role Key: supabase_________________
Dashboard URL: https://supabase.com/dashboard/project/_________________
```

---

## **What Files to Deploy**

### **Modified Files:**
- ✅ `supabase/functions/hybrid-email-accounts-v2/index.ts`

### **New Files to Upload/Run:**
- ✅ `supabase/migrations/20251010000000_create_email_accounts_cache.sql` (Run in SQL Editor)
- ✅ `supabase/migrations/20251010000001_setup_email_cache_cron.sql` (Run in SQL Editor)
- ✅ `supabase/functions/sync-email-accounts-cache/index.ts` (Create new Edge Function)

---

## **Post-Deployment Monitoring**

### **Dashboard to Monitor:**
```sql
-- Run this every hour for first 3 days
SELECT
  started_at,
  status,
  duration_seconds || 's' as duration,
  total_accounts_fetched as accounts,
  total_workspaces_processed as workspaces,
  CASE
    WHEN status = 'success' THEN '✅'
    WHEN status = 'partial' THEN '⚠️'
    ELSE '❌'
  END as icon
FROM email_sync_logs
ORDER BY started_at DESC
LIMIT 10;
```

### **Health Check:**
```sql
SELECT
  last_sync_time,
  last_sync_status,
  total_accounts,
  minutes_since_last_sync,
  CASE
    WHEN is_healthy THEN '✅ HEALTHY - Sync is working'
    ELSE '❌ UNHEALTHY - Sync not running'
  END as health_status
FROM public.get_email_sync_health();
```

---

## **Success Criteria**

- [ ] Phase 1 deployed successfully
- [ ] Jason Binyon shows 433 accounts (not 15)
- [ ] Enhanced logs visible in Edge Function logs
- [ ] Phase 2 migrations completed
- [ ] Cron job created and active
- [ ] Background sync function deployed
- [ ] Manual sync test successful
- [ ] `email_sync_logs` table has at least 1 successful entry
- [ ] `email_accounts_cache` has 4,000+ records
- [ ] Sync health check returns "HEALTHY"

---

**Ready to deploy!** Start with Option 1 (Dashboard) if Supabase CLI isn't installed, or use Option 2 for faster deployment.

Need help? Check the logs at:
- Edge Functions: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions
- SQL Logs: Run queries in SQL Editor
