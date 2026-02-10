# Email Infrastructure Dashboard - Missing Workspaces Fix

## Problem Summary

The dashboard is showing **24 workspaces** instead of **28**. Four workspaces have 0 accounts displayed:
- Castle Agency
- Schrauf Agency
- StreetSmart P&C
- Maverick In-house

## Root Cause

The issue is a **database constraint conflict**, not an API problem.

### What's Happening

1. These 4 workspaces have workspace-specific API keys configured in `client_registry`
2. When syncing, the Email Bison API returns accounts for these workspaces
3. **BUT**: The same Email Bison accounts (same `bison_account_id`) also appear in other workspaces:
   - The Jake Ferrara accounts appear in LeBlanc Agency, StreetSmart Commercial, and StreetSmart Trucking
   - There are ~237 duplicate Jake Ferrara accounts across workspaces

4. The current database constraint is:
   ```sql
   UNIQUE (bison_account_id, bison_instance)
   ```

5. This means **only ONE workspace can "own" each account**
6. When the sync runs sequentially, the **last workspace to sync wins**
7. Since LeBlanc Agency syncs after Castle/Schrauf/StreetSmart P&C, it overwrites their accounts

## The Fix

Change the unique constraint to allow the same Email Bison account to appear in multiple workspaces:

### Step 1: Apply This SQL in Supabase Dashboard

Go to: **Supabase Dashboard** → **SQL Editor** → **New Query**

Run this SQL:

```sql
-- Drop the old constraint
ALTER TABLE public.email_accounts_raw
  DROP CONSTRAINT IF EXISTS unique_bison_account;

-- Add new constraint that includes workspace_id
ALTER TABLE public.email_accounts_raw
  ADD CONSTRAINT unique_bison_account_per_workspace
  UNIQUE (bison_account_id, bison_instance, workspace_id);
```

### Step 2: The Edge Function is Already Updated

The edge function `/supabase/functions/poll-sender-emails/index.ts` has been updated to use the new constraint:

```typescript
.upsert(accountRecords, {
  onConflict: 'bison_account_id,bison_instance,workspace_id'
})
```

This change is already deployed.

### Step 3: Trigger a New Sync

After applying the SQL, trigger a new sync:

```bash
curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"
```

Or trigger from the Supabase dashboard.

### Step 4: Verify

After the sync completes, run this to verify:

```sql
SELECT
  workspace_name,
  COUNT(*) as account_count
FROM email_accounts_raw
WHERE deleted_at IS NULL
GROUP BY workspace_name
ORDER BY workspace_name;
```

You should now see all 28 workspaces with their account counts.

## Why This Happens

The workspace-specific API keys for Castle Agency (ID 48), Schrauf Agency (ID 49), and StreetSmart P&C (ID 22) are configured in Email Bison to return accounts that also belong to other workspaces. This is likely a configuration issue in Email Bison itself, where these API keys have access to a shared pool of accounts.

## Impact

- **Before**: Only 24 workspaces show on dashboard, 4,623 total accounts
- **After**: All 28 workspaces will show, with accounts appearing in multiple workspaces if their API keys return them
- Accounts with 0 emails sent will still be filtered out by the `email_accounts_view` unless the view definition is also updated

## Alternative Solution

If you don't want duplicate accounts across workspaces, you need to fix the Email Bison workspace configuration so each workspace-specific API key only returns accounts that belong exclusively to that workspace.
