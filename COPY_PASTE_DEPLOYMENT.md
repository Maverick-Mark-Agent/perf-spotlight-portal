# 📋 Copy/Paste Deployment Guide

**All files ready to copy/paste directly into Supabase Dashboard**

---

## 🚀 PHASE 1: Deploy Pagination Fix

### Step 1: Deploy hybrid-email-accounts-v2

**Dashboard Link:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions

1. Find `hybrid-email-accounts-v2` in the list
2. Click on it
3. Click "Deploy" or "Edit"
4. **Copy the file contents below** and paste into the editor
5. Click "Deploy"

**File:** `supabase/functions/hybrid-email-accounts-v2/index.ts`

The file is ready at:
```
/Users/mac/Downloads/perf-spotlight-portal/supabase/functions/hybrid-email-accounts-v2/index.ts
```

**To copy it quickly:**
```bash
# macOS - copies to clipboard
cat /Users/mac/Downloads/perf-spotlight-portal/supabase/functions/hybrid-email-accounts-v2/index.ts | pbcopy
```

Then paste (Cmd+V) into Supabase editor.

---

### Step 2: Test Phase 1

**Go to:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/hybrid-email-accounts-v2/logs

**Invoke the function:**
- Click "Invoke" button in dashboard, OR
- Use curl command (get SERVICE_ROLE_KEY from: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/api)

```bash
curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2 \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Look for in logs:**
```
✅ [Maverick] Jason Binyon: Fetched 433 accounts across 29 pages in 12.5s
```

✅ **If you see this, Phase 1 SUCCESS!**

---

## 🗄️ PHASE 2: Deploy Background Sync

### Step 3: Run Migration 1 - Create Cache Tables

**Dashboard Link:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql

1. Click "New query"
2. **Copy entire SQL file** and paste
3. Click "RUN"

**File:** `supabase/migrations/20251010000000_create_email_accounts_cache.sql`

**To copy it quickly:**
```bash
# macOS - copies to clipboard
cat /Users/mac/Downloads/perf-spotlight-portal/supabase/migrations/20251010000000_create_email_accounts_cache.sql | pbcopy
```

Then paste (Cmd+V) into SQL Editor and click RUN.

**Expected output:**
```
✅ Email accounts cache infrastructure created successfully!
```

---

### Step 4: Run Migration 2 - Setup Cron Job

**Still in SQL Editor**

1. Click "New query"
2. **Copy entire SQL file** and paste
3. Click "RUN"

**File:** `supabase/migrations/20251010000001_setup_email_cache_cron.sql`

**To copy it quickly:**
```bash
# macOS - copies to clipboard
cat /Users/mac/Downloads/perf-spotlight-portal/supabase/migrations/20251010000001_setup_email_cache_cron.sql | pbcopy
```

Then paste (Cmd+V) into SQL Editor and click RUN.

**Expected output:**
```
✅ Email cache sync cron job configured!
```

---

### Step 5: Configure PostgreSQL Settings

**Still in SQL Editor**

1. Get your SERVICE_ROLE_KEY: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/api
2. Click "service_role" and "Reveal" to see the key
3. Copy it
4. Run this SQL (replace YOUR_SERVICE_ROLE_KEY with actual key):

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://gjqbbgrfhijescaouqkx.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

---

### Step 6: Deploy sync-email-accounts-cache Function

**Dashboard Link:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions

1. Click "Create a new function"
2. **Name:** `sync-email-accounts-cache`
3. **Copy the file contents** and paste into editor
4. Click "Deploy"

**File:** `supabase/functions/sync-email-accounts-cache/index.ts`

**To copy it quickly:**
```bash
# macOS - copies to clipboard
cat /Users/mac/Downloads/perf-spotlight-portal/supabase/functions/sync-email-accounts-cache/index.ts | pbcopy
```

Then paste (Cmd+V) into Supabase editor.

---

### Step 7: Test Phase 2

**Invoke the sync function:**

```bash
curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-email-accounts-cache \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Check logs:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/sync-email-accounts-cache/logs

**Look for:**
```
✅ EMAIL ACCOUNTS CACHE SYNC COMPLETED
Duration: 45s
Total Accounts: 4123
```

✅ **If you see this, Phase 2 SUCCESS!**

---

## ✅ VERIFICATION

**Run these in SQL Editor:**

```sql
-- Check Jason Binyon account count (should be 433)
SELECT COUNT(*) as jason_accounts
FROM email_accounts_cache
WHERE workspace_name ILIKE '%Jason Binyon%';

-- Check total accounts (should be 4000+)
SELECT COUNT(*) as total_accounts
FROM email_accounts_cache
WHERE sync_status = 'success';

-- Check sync health (should be HEALTHY)
SELECT
  last_sync_time,
  last_sync_status,
  total_accounts,
  minutes_since_last_sync,
  CASE
    WHEN is_healthy THEN '✅ HEALTHY'
    ELSE '❌ UNHEALTHY'
  END as health_status
FROM public.get_email_sync_health();

-- Check cron job (should be active)
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'sync-email-accounts-cache';
```

---

## 🎯 SUCCESS CHECKLIST

- [ ] Phase 1 deployed - hybrid-email-accounts-v2 updated
- [ ] Test shows "Fetched 433 accounts across 29 pages"
- [ ] Migration 1 successful - Tables created
- [ ] Migration 2 successful - Cron job configured
- [ ] PostgreSQL settings configured
- [ ] sync-email-accounts-cache function deployed
- [ ] Manual sync test successful
- [ ] Jason Binyon: 433 accounts ✅
- [ ] Total accounts: 4000+ ✅
- [ ] Sync health: HEALTHY ✅

---

## 🚀 Quick Copy Commands

Open terminal and run these to copy files to clipboard:

```bash
# Copy Phase 1 - Edge Function
cat /Users/mac/Downloads/perf-spotlight-portal/supabase/functions/hybrid-email-accounts-v2/index.ts | pbcopy

# Copy Phase 2 - Migration 1
cat /Users/mac/Downloads/perf-spotlight-portal/supabase/migrations/20251010000000_create_email_accounts_cache.sql | pbcopy

# Copy Phase 2 - Migration 2
cat /Users/mac/Downloads/perf-spotlight-portal/supabase/migrations/20251010000001_setup_email_cache_cron.sql | pbcopy

# Copy Phase 2 - Sync Function
cat /Users/mac/Downloads/perf-spotlight-portal/supabase/functions/sync-email-accounts-cache/index.ts | pbcopy
```

After each command, just paste (Cmd+V) into the appropriate place in Supabase Dashboard.

---

**Time to complete:** ~30 minutes
**Priority:** Phase 1 first (critical), then Phase 2
