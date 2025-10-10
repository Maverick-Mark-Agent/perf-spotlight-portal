# Email Accounts Two-Table Setup - Next Steps

## Current Status

### ✅ Completed:
1. **Database Migration Created** - [supabase/migrations/20251009220000_create_email_accounts_tables.sql](../supabase/migrations/20251009220000_create_email_accounts_tables.sql)
   - `email_accounts_raw` table (backend sync)
   - `email_accounts_view` materialized view (frontend display)
   - `refresh_email_accounts_view()` function

2. **Sync Edge Function Created** - [supabase/functions/sync-email-accounts/index.ts](../supabase/functions/sync-email-accounts/index.ts)
   - Fetches accounts from Email Bison API per workspace
   - Calculates pricing dynamically
   - Upserts to `email_accounts_raw`
   - Refreshes `email_accounts_view` after sync

3. **Frontend Filter Fix** - Fixed validation filter in dataService.ts to show all 4,000+ accounts

### ⏳ Remaining Steps:

## Step 1: Deploy Database Migration (MANUAL - YOU DO THIS)

**Why manual**: Automated `npx supabase db push` blocked by old migration files

**How to deploy**:
1. Go to https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx
2. Click **SQL Editor** in left sidebar
3. Click **New query**
4. Open `supabase/migrations/20251009220000_create_email_accounts_tables.sql`
5. Copy entire file contents
6. Paste into Supabase SQL Editor
7. Click **Run** button

**Verify it worked**:
```sql
-- Should return 2 rows
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('email_accounts_raw', 'email_accounts_view');
```

---

## Step 2: Deploy Sync Edge Function (I WILL DO THIS)

Once you confirm Step 1 is done, I'll run:

```bash
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"
SUPABASE_ACCESS_TOKEN=sbp_765c83453a7d30be808b30e47cc230e0e9686015 \
npx supabase functions deploy sync-email-accounts
```

---

## Step 3: Run Initial Sync (I WILL DO THIS)

Populate `email_accounts_raw` with all 4,000+ accounts:

```bash
# Sync all 24 workspaces
curl -X POST \
  "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-email-accounts" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected result:
```json
{
  "success": true,
  "summary": {
    "workspaces_synced": 24,
    "total_accounts": 4278,
    "duration_ms": 45000
  }
}
```

---

## Step 4: Update Frontend to Use New Tables (I WILL DO THIS)

Change [src/services/realtimeDataService.ts](../src/services/realtimeDataService.ts):

```typescript
// OLD (currently using)
const { data: accounts } = await supabase
  .from('sender_emails_cache')  // ❌ Old table (incomplete data)
  .select('*');

// NEW (will use)
const { data: accounts } = await supabase
  .from('email_accounts_view')  // ✅ New materialized view
  .select('*');
```

---

## Step 5: Set Up Automatic Sync Cron Job (I WILL DO THIS)

Schedule sync every 15 minutes:

```sql
SELECT cron.schedule(
  'sync-email-accounts-all',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-email-accounts',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

## Benefits After Setup Complete

### Problem You Reported:
> "I'm seeing 4 clients on the dashboard that have the same amount of email accounts. However, I know that's not true."

### Root Cause:
- Current system uses `hybrid-email-accounts-v2` Edge Function
- Fetches all 4,000+ accounts from Email Bison API in real-time (30-60s)
- Timeouts cause incomplete/inconsistent data
- No persistent storage → data changes between refreshes

### Solution (Two-Table Architecture):

**Before (Current)**:
```
Dashboard → Edge Function → Email Bison API (30-60s timeout)
```

**After (New System)**:
```
Dashboard → email_accounts_view (<100ms query)
                ↑
         Synced every 15 min
                ↑
    email_accounts_raw (one source of truth)
                ↑
         Per-workspace sync from Email Bison API
```

**Results**:
- ✅ **Consistent counts** - One source of truth, no duplicates
- ✅ **<100ms load time** - Query materialized view (vs 30-60s Edge Function)
- ✅ **No timeouts** - Data pre-cached, fetched incrementally
- ✅ **Real-time updates** - Automatic sync every 15 minutes
- ✅ **Per-workspace accuracy** - Each client's accounts tracked separately

---

## What to Do Next

**YOU**: Deploy Step 1 (SQL migration via Supabase dashboard)

**THEN TELL ME**: "Migration deployed" or "Tables created"

**ME**: I'll immediately complete Steps 2-5 automatically

---

## Files Ready to Deploy

1. ✅ `supabase/migrations/20251009220000_create_email_accounts_tables.sql`
2. ✅ `supabase/functions/sync-email-accounts/index.ts`
3. ✅ Updated `src/services/dataService.ts` (filter fix for current system)

**Waiting on**: You to run the SQL migration in Supabase dashboard
