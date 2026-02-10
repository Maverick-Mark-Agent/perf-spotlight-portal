# ✅ Deployment Checklist - Email Dashboard Fix

**Project:** `gjqbbgrfhijescaouqkx`
**Time:** ~30 minutes total

---

## 📋 PHASE 1: Fix Pagination (10 min) ⚡ URGENT

### **Deploy Updated Edge Function**

1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions
2. Find `hybrid-email-accounts-v2`
3. Click "Deploy" → Copy contents of `supabase/functions/hybrid-email-accounts-v2/index.ts`
4. Paste and Deploy

### **Test It**
```bash
curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2 \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Look for logs:** `✅ [Maverick] Jason Binyon: Fetched 433 accounts across 29 pages`

---

## 📋 PHASE 2: Background Sync (20 min)

### **Run Migrations**

1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql
2. New Query → Paste contents of `supabase/migrations/20251010000000_create_email_accounts_cache.sql`
3. RUN
4. New Query → Paste contents of `supabase/migrations/20251010000001_setup_email_cache_cron.sql`
5. RUN

### **Configure Settings**
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://gjqbbgrfhijescaouqkx.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_KEY';
```

### **Deploy Sync Function**

1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions
2. "Create new function" → Name: `sync-email-accounts-cache`
3. Copy contents of `supabase/functions/sync-email-accounts-cache/index.ts`
4. Deploy

### **Test It**
```bash
curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-email-accounts-cache \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## ✅ VERIFICATION (5 min)

Run in SQL Editor:

```sql
-- Should return 433
SELECT COUNT(*) FROM email_accounts_cache WHERE workspace_name ILIKE '%Jason Binyon%';

-- Should return 4000+
SELECT COUNT(*) FROM email_accounts_cache WHERE sync_status = 'success';

-- Should return true
SELECT is_healthy FROM public.get_email_sync_health();

-- Check cron job
SELECT * FROM cron.job WHERE jobname = 'sync-email-accounts-cache';
```

---

## 🎯 SUCCESS = All Green

- [ ] Jason Binyon: 433 accounts (not 15)
- [ ] Total accounts: 4000+
- [ ] Sync health: HEALTHY
- [ ] Cron job: Active
- [ ] Logs show successful sync

---

**Files to Copy:**
1. `supabase/functions/hybrid-email-accounts-v2/index.ts`
2. `supabase/migrations/20251010000000_create_email_accounts_cache.sql`
3. `supabase/migrations/20251010000001_setup_email_cache_cron.sql`
4. `supabase/functions/sync-email-accounts-cache/index.ts`

**Get SERVICE_ROLE_KEY:**
https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/api

---

See **DEPLOY_NOW.md** for detailed step-by-step instructions.
