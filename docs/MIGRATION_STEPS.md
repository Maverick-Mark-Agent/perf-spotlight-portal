# Email Accounts Infrastructure - Airtable to Supabase Migration Steps

## Status: Ready to Execute

All code is built and deployed. Airtable remains live during this process.

---

## Step 1: Create Supabase Table

**Action Required:** Run the SQL migration in Supabase

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new)

2. Copy and paste the SQL from: `supabase/migrations/20251003000000_create_email_account_metadata.sql`

3. Click "Run" to create the table

**Expected result:** Table `email_account_metadata` created with columns:
- `id` (uuid, primary key)
- `email_address` (text, unique)
- `price` (decimal)
- `notes` (text)
- `custom_tags` (jsonb)
- `created_at`, `updated_at` (timestamps)

---

## Step 2: Run Data Migration

**Action:** Migrate existing Airtable data to Supabase

```bash
curl -X POST 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/migrate-airtable-to-supabase' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0' \
  -H 'Content-Type: application/json'
```

**Expected output:**
```json
{
  "success": true,
  "message": "Migration completed successfully",
  "stats": {
    "totalAirtableRecords": 500,
    "recordsToMigrate": 500,
    "migratedCount": 500,
    "errors": 0
  },
  "sampleData": [...]
}
```

**What this does:**
- Fetches all email account records from Airtable
- Extracts email address and price
- Inserts into Supabase `email_account_metadata` table
- Uses upsert (on conflict, update) so it's safe to run multiple times

---

## Step 3: Verify Migration

**Action:** Check data in Supabase

1. Go to [Supabase Table Editor](https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/editor)

2. Select `email_account_metadata` table

3. Verify:
   - Records exist
   - Email addresses match Airtable
   - Prices are correct

**Quick SQL check:**
```sql
-- Count records
SELECT COUNT(*) FROM email_account_metadata;

-- Check sample with prices
SELECT email_address, price
FROM email_account_metadata
WHERE price > 0
LIMIT 10;

-- Check for duplicates (should be 0)
SELECT email_address, COUNT(*)
FROM email_account_metadata
GROUP BY email_address
HAVING COUNT(*) > 1;
```

---

## Step 4: Deploy V2 Function (Supabase-based)

**Status:** ⏳ Pending - Will create next

This will create `hybrid-email-accounts-v2` function that:
- Pulls metrics from Email Bison (same as current)
- Pulls metadata from **Supabase** instead of Airtable
- Returns exact same data structure (no dashboard changes needed)

---

## Step 5: Test V2 Function

**Action:** Compare V1 (Airtable) vs V2 (Supabase) output

```bash
# Test current function (using Airtable)
curl 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts'

# Test new function (using Supabase)
curl 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2'
```

**Verify:**
- Same number of accounts
- Prices match
- All fields populated

---

## Step 6: Switch Dashboard to V2

**Action:** Update frontend to use v2 function

Change in `src/pages/EmailAccountsPage.tsx`:
```typescript
// OLD
const { data, error } = await supabase.functions.invoke('hybrid-email-accounts');

// NEW
const { data, error } = await supabase.functions.invoke('hybrid-email-accounts-v2');
```

---

## Step 7: Monitor & Verify

**After switching:**

1. Clear cache: `localStorage.removeItem('email-accounts-data')`
2. Reload Infrastructure dashboard
3. Verify all data displays correctly
4. Check console for errors
5. Test filtering, sorting, charts

---

## Step 8: Cleanup (After 1 week of stable operation)

1. **Rename functions:**
   ```bash
   # Backup old function
   mv hybrid-email-accounts/index.ts hybrid-email-accounts-airtable-backup.ts

   # Promote v2 to main
   mv hybrid-email-accounts-v2/index.ts hybrid-email-accounts/index.ts

   # Redeploy
   supabase functions deploy hybrid-email-accounts
   ```

2. **Update dashboard back to original name:**
   ```typescript
   const { data, error } = await supabase.functions.invoke('hybrid-email-accounts');
   ```

3. **Remove Airtable dependency:**
   - Remove `AIRTABLE_API_KEY` from Supabase secrets (optional, keep for other uses)
   - Archive Airtable "Email Accounts" table (don't delete, just mark as archived)

---

## Rollback Plan

If issues occur at any step:

**Before Step 6 (switching dashboard):**
- No rollback needed, Airtable still active

**After Step 6 (switched to v2):**
```typescript
// Revert dashboard to v1
const { data, error } = await supabase.functions.invoke('hybrid-email-accounts');
```

**If Supabase data is corrupt:**
- Re-run migration (Step 2)
- Upsert will fix any issues

---

## Current Status

✅ Step 1: Table schema created (SQL ready)
✅ Step 2: Migration function deployed
⏳ Step 3: Awaiting table creation to run migration
⏳ Step 4: V2 function pending
⏳ Step 5-8: Pending

---

## Next Action

**You need to:** Run the SQL in Step 1 to create the table, then we can proceed with migration.

Would you like me to:
1. Wait for you to create the table, or
2. Continue building the V2 function in parallel?
