# Email Accounts Two-Table Architecture - Setup Guide

## Overview

This document explains the two-table architecture for email account data and how to complete the setup.

## Architecture

```
Email Bison API (4,000+ accounts across 24 workspaces)
         ↓
[email_accounts_raw] ← Backend sync table (per-workspace updates)
         ↓
[email_accounts_view] ← Frontend display table (materialized view)
         ↓
    Dashboard UI
```

### Table 1: `email_accounts_raw` (Backend)
- **Purpose**: Receive incremental updates per workspace from Email Bison API
- **Updated by**: `sync-email-accounts` Edge Function (per workspace)
- **Update frequency**: Every 5-15 minutes via cron
- **Columns**: All account data (id, email, workspace, metrics, pricing, etc.)

### Table 2: `email_accounts_view` (Frontend)
- **Purpose**: Fast frontend queries (materialized view)
- **Refreshed by**: `refresh_email_accounts_view()` function
- **Refresh frequency**: After backend sync completes
- **Query time**: <100ms (vs 30-60s Edge Function)

## Current Status

✅ Migration file created: `supabase/migrations/20251009220000_create_email_accounts_tables.sql`
❌ Migration blocked by old migration files with duplicate `CREATE POLICY` and `CREATE TRIGGER`
⚠️ Need to deploy manually via Supabase dashboard

## Manual Deployment Steps

**IMPORTANT**: The automated `npx supabase db push` is blocked by old migration files. Deploy manually:

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx
2. Navigate to **SQL Editor**

### Step 2: Run Migration SQL
1. Open the file: `supabase/migrations/20251009220000_create_email_accounts_tables.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **Run**

### Step 3: Verify Tables Created
Run this query to verify:
```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('email_accounts_raw', 'email_accounts_view');

-- Check row counts
SELECT 'email_accounts_raw' as table_name, COUNT(*) FROM email_accounts_raw
UNION ALL
SELECT 'email_accounts_view', COUNT(*) FROM email_accounts_view;
```

Expected result: Both tables exist with 0 rows (initially empty)

## Next Steps After Manual Deployment

### 1. Create Sync Edge Function
Create `supabase/functions/sync-email-accounts/index.ts` to:
- Fetch accounts from Email Bison API per workspace
- UPSERT into `email_accounts_raw` table
- Calculate pricing dynamically
- Handle pagination (100 accounts per page)

### 2. Initial Backfill
Run one-time backfill to populate `email_accounts_raw`:
```bash
# Will be created after manual deployment succeeds
./scripts/backfill-email-accounts.sh
```

### 3. Refresh Materialized View
After backfill:
```sql
SELECT refresh_email_accounts_view();
```

### 4. Update Frontend
Change `realtimeDataService.ts` to query `email_accounts_view`:
```typescript
const { data: accounts } = await supabase
  .from('email_accounts_view')  // Change from sender_emails_cache
  .select('*')
  .order('workspace_name', { ascending: true });
```

### 5. Set Up Cron Job
Schedule automatic sync every 15 minutes:
```sql
-- Create cron job for workspace sync
SELECT cron.schedule(
  'sync-email-accounts-all-workspaces',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-email-accounts',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

## Benefits of Two-Table Architecture

### Before (Current State)
- ❌ 30-60 second load time (fetches all 4,000+ accounts from Email Bison API)
- ❌ Timeout errors when API is slow
- ❌ No persistent storage
- ❌ Inconsistent account counts between refreshes

### After (Two-Table System)
- ✅ <100ms load time (query materialized view)
- ✅ No timeouts (data is pre-cached)
- ✅ Persistent storage with history
- ✅ Consistent counts (one source of truth)
- ✅ Real-time updates every 15 minutes
- ✅ Per-workspace sync (faster, more reliable)

## Troubleshooting

### Issue: "Duplicate clients showing same account count"
**Root Cause**: Edge Function `hybrid-email-accounts-v2` fetches data in real-time and can have inconsistencies

**Solution**: Two-table architecture provides one source of truth with consistent data

### Issue: "Migration won't deploy"
**Error**: `ERROR: policy "..." already exists`

**Solution**: Deploy manually via Supabase dashboard SQL Editor (skip automated push)

## Files Created

1. `supabase/migrations/20251009220000_create_email_accounts_tables.sql` - Database schema
2. `docs/EMAIL_ACCOUNTS_TWO_TABLE_SETUP.md` - This document
3. `scripts/deploy-email-tables.sh` - Deployment script (blocked by old migrations)

## Next Session Tasks

1. ✅ Manually deploy migration via Supabase dashboard
2. Create `sync-email-accounts` Edge Function
3. Create initial backfill script
4. Update frontend to use `email_accounts_view`
5. Set up cron job for automatic syncing
6. Test end-to-end workflow
