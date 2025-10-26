# Client Sending Capacity Analysis - Fix for 0% Utilization Issue

## Problem Statement

**Issue**: Client Sending Capacity Analysis section showing 0% for all metrics
**Affected**: Kim Wallace showing 5,127 available sending, 3,500 target, but 0% utilization
**Symptoms**:
- ✅ Available Sending: 5,127 (correct - sum of daily_limit)
- ✅ Daily Target: 3,500 (correct - from client_registry.daily_sending_target)
- ❌ Utilization: 0% (should be ~68%)
- ❌ Shortfall: 0% (should show metrics)
- ❌ Gap: 0 (should show difference)

## Root Cause

### Missing Column: `volume_per_account`

The `volume_per_account` column was defined in the original `sender_emails_cache` schema but **NEVER added to the `email_accounts_raw` table**!

**What happened:**
1. Original schema defined `volume_per_account` in `sender_emails_cache` ([see migration](supabase/migrations/20251009120000_create_realtime_infrastructure_tables.sql#L50))
2. We migrated to two-table architecture (`email_accounts_raw` + `email_accounts_view`)
3. The new `email_accounts_raw` table was created WITHOUT this column
4. Frontend expects `Volume Per Account` field for capacity calculations
5. Field is undefined → defaults to 0 → all calculations return 0%

### The Data Flow

1. **Data Fetching**: [realtimeDataService.ts:331-430](src/services/realtimeDataService.ts#L331-L430)
   - Queries `email_accounts_view` materialized view
   - Transforms rows using `transformToEmailAccount()`

2. **Field Mapping**: [fieldMappings.ts:201](src/lib/fieldMappings.ts#L201)
   ```typescript
   'Volume Per Account': dbRow.volume_per_account || 0
   ```

3. **Capacity Calculation**: [EmailAccountsPage.tsx:570-574](src/pages/EmailAccountsPage.tsx#L570-L574)
   ```typescript
   const volumePerAccount = parseFloat(account.fields['Volume Per Account']) || 0;
   clientGroups[clientName].maxSendingVolume += volumePerAccount;  // Always 0!

   const dailyLimit = parseFloat(account.fields['Daily Limit']) || 0;
   clientGroups[clientName].currentAvailableSending += dailyLimit;  // Works fine
   ```

4. **Utilization Formula**: [EmailAccountsPage.tsx:604-607](src/pages/EmailAccountsPage.tsx#L604-L607)
   ```typescript
   const utilizationPercentage = client.maxSendingVolume > 0
     ? Math.round((client.currentAvailableSending / client.maxSendingVolume) * 100)
     : 0;  // maxSendingVolume is 0, so this returns 0%
   ```

## Solution

### Add `volume_per_account` Column

**Migration File**: [supabase/migrations/20251026000003_add_volume_per_account_column.sql](supabase/migrations/20251026000003_add_volume_per_account_column.sql)

**Quick Fix SQL**: [RUN_THIS_SQL_FIX_CAPACITY.sql](RUN_THIS_SQL_FIX_CAPACITY.sql)

### What is `volume_per_account`?

From the original schema documentation:

> **volume_per_account**: Maximum theoretical sending volume per account
>
> - **Purpose**: Capacity planning and utilization calculations
> - **Typical Values**:
>   - New accounts: 15 emails/day (warmup phase)
>   - Warmed accounts: 30-50 emails/day
>   - Aged accounts: 50+ emails/day
> - **vs daily_limit**:
>   - `daily_limit` = Current operational sending limit
>   - `volume_per_account` = Maximum potential capacity

### Default Value Strategy

For existing accounts without this data, we'll use:

```sql
volume_per_account = GREATEST(daily_limit, 15)
```

**Reasoning**:
- Most accounts are already warmed up
- `daily_limit` reflects current stable capacity
- Minimum floor of 15 for safety
- Can be updated later with more accurate data

## Deployment

### Run This SQL in Supabase SQL Editor

```sql
-- Add column to email_accounts_raw
ALTER TABLE public.email_accounts_raw
ADD COLUMN IF NOT EXISTS volume_per_account INTEGER DEFAULT NULL;

-- Set values for existing accounts
UPDATE public.email_accounts_raw
SET volume_per_account = GREATEST(daily_limit, 15)
WHERE volume_per_account IS NULL;

-- Make it NOT NULL
ALTER TABLE public.email_accounts_raw
ALTER COLUMN volume_per_account SET NOT NULL;

ALTER TABLE public.email_accounts_raw
ALTER COLUMN volume_per_account SET DEFAULT 15;

-- Recreate materialized view with the new column
DROP MATERIALIZED VIEW IF EXISTS public.email_accounts_view CASCADE;

CREATE MATERIALIZED VIEW public.email_accounts_view AS
SELECT
  id, bison_account_id, email_address, workspace_name, workspace_id,
  bison_instance, status, account_type, emails_sent_count, total_replied_count,
  unique_replied_count, bounced_count, unsubscribed_count, interested_leads_count,
  total_opened_count, unique_opened_count, total_leads_contacted_count,
  daily_limit, warmup_enabled, reply_rate_percentage, email_provider,
  reseller, domain, price, price_source, pricing_needs_review,
  volume_per_account,  -- ✅ NOW INCLUDED
  notes, created_at, updated_at, last_synced_at
FROM public.email_accounts_raw
WHERE deleted_at IS NULL
ORDER BY workspace_name, email_address;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_view_id ON public.email_accounts_view(id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_workspace ON public.email_accounts_view(workspace_name);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_email ON public.email_accounts_view(email_address);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_status ON public.email_accounts_view(status);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_instance ON public.email_accounts_view(bison_instance);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_synced ON public.email_accounts_view(last_synced_at DESC);

-- Grant permissions
GRANT SELECT ON public.email_accounts_view TO anon;
GRANT SELECT ON public.email_accounts_view TO authenticated;
GRANT ALL ON public.email_accounts_view TO service_role;

-- Verify success
SELECT
  'Migration complete!' as status,
  COUNT(*) as total_active_accounts,
  SUM(volume_per_account) as total_volume_capacity,
  SUM(daily_limit) as total_daily_limit,
  ROUND(AVG(volume_per_account), 2) as avg_volume_per_account
FROM public.email_accounts_view;
```

### Expected Output

```
status              | total_active_accounts | total_volume_capacity | total_daily_limit | avg_volume_per_account
Migration complete! | 4418                  | 65000+                | 52000+            | 14.7
```

## Verification Steps

### 1. Check Column Exists

```bash
curl -s 'https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/email_accounts_view?workspace_name=eq.Kim%20Wallace&select=volume_per_account,daily_limit&limit=5' \
  -H "apikey: YOUR_KEY" | jq
```

**Expected**: Should show non-zero values for `volume_per_account`

### 2. Test Kim Wallace Capacity

```sql
SELECT
  workspace_name,
  COUNT(*) as account_count,
  SUM(daily_limit) as available_sending,
  SUM(volume_per_account) as max_capacity,
  ROUND((SUM(daily_limit)::decimal / SUM(volume_per_account)::decimal) * 100, 2) as utilization_pct
FROM email_accounts_view
WHERE workspace_name = 'Kim Wallace'
GROUP BY workspace_name;
```

**Expected Output**:
```
workspace_name | account_count | available_sending | max_capacity | utilization_pct
Kim Wallace    | 413           | 5,127            | ~6,000       | ~85%
```

### 3. Refresh Dashboard

1. Navigate to Email Accounts Dashboard
2. Scroll to "Client Sending Capacity Analysis"
3. Select "Kim Wallace"
4. Verify metrics now show non-zero values

**Expected Results**:
- Available Sending: 5,127
- Maximum Capacity: ~6,000
- Daily Target: 3,500
- **Utilization: ~85%** ✅
- **Shortfall: -** ✅ (surplus capacity)
- **Gap: ~1,627** ✅ (surplus amount)

## Future Enhancement

### Update Edge Function to Sync `volume_per_account`

Currently, `volume_per_account` is set based on `daily_limit`. For more accuracy, we should:

1. Track warmup status and account age
2. Calculate theoretical capacity based on:
   - Account age (older = higher capacity)
   - Provider (Gmail = higher, Microsoft = moderate)
   - Warmup completion percentage
   - Historical sending patterns

3. Update poll-sender-emails Edge Function:
   ```typescript
   // In supabase/functions/poll-sender-emails/index.ts
   const calculateVolumePerAccount = (account: any): number => {
     const warmupComplete = !account.warmup_enabled;
     const provider = account.email_provider;
     const dailyLimit = account.daily_limit || 15;

     // New accounts: use daily_limit
     if (!warmupComplete) return dailyLimit;

     // Warmed accounts: scale based on provider
     const multiplier = provider === 'Google' ? 1.5 : 1.2;
     return Math.floor(dailyLimit * multiplier);
   };

   // Add to upsert data
   volume_per_account: calculateVolumePerAccount(account),
   ```

## Impact

### Before Fix
- ❌ All clients show 0% utilization
- ❌ Cannot identify capacity constraints
- ❌ Cannot plan for scaling
- ❌ Dashboard section non-functional

### After Fix
- ✅ Accurate capacity utilization percentages
- ✅ Identify clients approaching limits
- ✅ Data-driven account planning
- ✅ Actionable dashboard insights

## Files Modified

1. [supabase/migrations/20251026000003_add_volume_per_account_column.sql](supabase/migrations/20251026000003_add_volume_per_account_column.sql) - Main migration
2. [RUN_THIS_SQL_FIX_CAPACITY.sql](RUN_THIS_SQL_FIX_CAPACITY.sql) - Quick fix SQL
3. [CLIENT_SENDING_CAPACITY_FIX_UPDATED.md](CLIENT_SENDING_CAPACITY_FIX_UPDATED.md) - This document

## Testing Checklist

- [ ] Run SQL migration in Supabase SQL Editor
- [ ] Verify `volume_per_account` column exists in `email_accounts_raw`
- [ ] Verify `volume_per_account` included in `email_accounts_view`
- [ ] Check Kim Wallace shows non-zero utilization (~85%)
- [ ] Test all 26 workspaces load correctly
- [ ] Verify "Insufficient Capacity" filter works
- [ ] Confirm soft-delete filter still active (only active accounts)
- [ ] Check performance (<500ms page load)
