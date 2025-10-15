# High Net Worth Contact Filtering to Kirk Hodgson - UPDATED

## Overview

All high net worth (HNW) contacts with home values ≥$900,000 from Texas agencies are automatically **MOVED** (not duplicated) to Kirk Hodgson's pipeline. This ensures Kirk receives qualified HNW leads while preventing the original agencies from having duplicate contacts in their pipelines.

## Key Changes (October 2025)

### What Changed
1. **Threshold**: $750k → **$900k** (reverted to original threshold)
2. **Behavior**: **Duplicate → MOVE** (critical change)
3. **Database**: New `clean_contact_target` field for tracking verified contact goals

### Old Behavior (Before Oct 2025)
```
Kim uploads 10,000 contacts with 500 HNW TX contacts
Result: Kim has 10,000 contacts AND Kirk has 500 contacts (DUPLICATES)
```

### New Behavior (After Oct 2025)
```
Kim uploads 10,000 contacts with 500 HNW TX contacts
Result: Kim has 9,500 contacts, Kirk has 500 contacts (NO DUPLICATES)
```

## How It Works

### Automatic Filtering (Contact Upload)

When contacts are uploaded for any Texas agency through the Contact Pipeline Dashboard:

1. **CSV Upload** → The `process-contact-upload` Edge Function processes the CSV
2. **Home Value Parsing** → Handles commas and currency symbols ($1,250,000 → 1250000)
3. **HNW Detection** → Contacts with `property_state = 'TX'` AND `home_value_estimate >= $900,000` are flagged as HNW
4. **Split Routing** → Contacts are split BEFORE insertion:
   - HNW Texas contacts → Go to Kirk Hodgson's workspace ONLY
   - All other contacts → Go to original agency's workspace
5. **No Duplicates** → Each contact exists in ONLY ONE workspace

### Texas Agencies

The following agencies have HNW filtering enabled:
- **Kim Wallace**
- **David Amiri**
- **John Roberts**
- **Jason Binyon**

### Threshold

- **HNW Threshold:** ≥$900,000 home value (updated from $750k)
- **Geographic Filter:** Texas (TX) only
- **Contact Type:** Head of household with valid email and purchase date

## Implementation Details

### Edge Function Logic

**File:** `supabase/functions/process-contact-upload/index.ts`

Key logic (lines 286-363):
```typescript
// Process contacts
const processedContacts = rows.map(row => processContact(...));

// Split contacts if Texas agency
if (isTexasAgency) {
  const hnwTexasContacts = processedContacts.filter(
    c => c.is_high_net_worth && c.property_state === 'TX'
  );

  const standardContacts = processedContacts.filter(
    c => !(c.is_high_net_worth && c.property_state === 'TX')
  );

  // Insert standard contacts to original workspace
  await supabase.from('raw_contacts').insert(standardContacts);

  // Insert HNW contacts to Kirk ONLY
  const kirkContacts = hnwTexasContacts.map(c => ({
    ...c,
    workspace_name: 'Kirk Hodgson',
    uploaded_by: `hnw_auto_route_from_${originalWorkspace}`
  }));
  await supabase.from('raw_contacts').insert(kirkContacts);
}
```

### Home Value Column Analysis

**CSV Structure (Cole X Dates - 13 columns):**
1-10. Name, Address, City, State, ZIP fields (Mailing & Property)
11. **Home Value Estimate** ← ONLY column containing home value
12. Purchase Date
13. Email

**Parsing Logic (handles commas):**
```typescript
// Line 146 in process-contact-upload/index.ts
const homeValueStr = row['Home Value Estimate']?.replace(/[$,]/g, '') || '0';
const homeValue = parseFloat(homeValueStr) || 0;

// Examples:
// "$1,250,000" → 1250000 ✓
// "950000" → 950000 ✓
// "$850,000.50" → 850000.50 ✓
```

### Database Tables

Contacts flow through two main tables:

1. **`raw_contacts`** - Initial upload, before email verification
   - HNW contacts are routed to Kirk immediately
   - Tagged with `is_high_net_worth = true`
   - Kirk's copies have `uploaded_by = 'hnw_auto_route_from_{original_workspace}'`
   - **Original agency does NOT receive HNW contacts**

2. **`verified_contacts`** - After Debounce email verification
   - Contacts from `raw_contacts` are verified independently per workspace
   - Kirk's contacts are tagged with `target_campaign = 'HNW Evergreen'`

## Contact Pipeline Dashboard Changes

### New Column Structure

| # | Column Name | Description |
|---|-------------|-------------|
| 1 | Client | Agency name |
| 2 | **Clean Contact Target** | Goal for verified contacts (NEW field, defaults to 0) |
| 3 | ZIP Codes Pulled | Territory coverage |
| 4 | Verified | Email-verified contacts |
| 5 | **Total Raw Contacts** | All uploaded contacts (renamed from "Uploaded") |
| 6 | Gap | Clean Target - Verified |
| 7 | **Added to Campaign** | Batches in Email Bison (NEW) |

### Removed Columns
- ❌ Deliverable (no longer shown separately)
- ❌ Pending (no longer tracked)
- ❌ HNW (moved to Kirk's pipeline)
- ❌ Progress (percentage removed)

### Database View

**View:** `monthly_contact_pipeline_summary`

Updated fields:
- `clean_contact_target` (new)
- `total_raw_contacts` (renamed from raw_contacts_uploaded)
- `added_to_campaign_count` (new)
- `contacts_gap` (renamed from contacts_needed)

## Upload Workflow

### Example: Kim Wallace Uploads 10,000 Contacts for November

**Upload CSV** via Contact Pipeline Dashboard

**Processing:**
```
Total contacts: 10,000
├─ Head of household filter: 9,200 pass
├─ Email validation: 9,000 pass
├─ Purchase date validation: 8,800 pass
└─ Home value split (Texas only):
   ├─ Standard (<$900k): 8,500 → Kim Wallace
   └─ HNW (≥$900k): 300 → Kirk Hodgson
```

**Result:**
- Kim Wallace: 8,500 contacts in pipeline
- Kirk Hodgson: 300 HNW contacts automatically
- Total: 8,800 contacts (no duplicates)

**Upload Response:**
```
"Processed 10,000 contacts for Kim Wallace:
- 8,500 added to Kim Wallace
- 300 HNW Texas contacts moved to Kirk Hodgson
- 1,200 filtered out
- 45 ZIP codes added to territory map"
```

## Monitoring & Reports

### Check Kirk's HNW Pipeline

```sql
-- Current month HNW contacts for Kirk
SELECT
  month,
  COUNT(*) as total_hnw_contacts,
  COUNT(*) FILTER (WHERE debounce_status = 'deliverable') as deliverable
FROM verified_contacts
WHERE workspace_name = 'Kirk Hodgson'
  AND month = '2025-11'
  AND is_high_net_worth = true
GROUP BY month;
```

### View Upload Audit Trail

```sql
-- See which contacts were routed from which agency
SELECT
  uploaded_by,
  month,
  COUNT(*) as contacts,
  AVG(home_value_estimate) as avg_home_value,
  MIN(home_value_estimate) as min_value,
  MAX(home_value_estimate) as max_value
FROM raw_contacts
WHERE workspace_name = 'Kirk Hodgson'
  AND uploaded_by LIKE 'hnw_auto_route_from_%'
GROUP BY uploaded_by, month
ORDER BY month DESC, uploaded_by;
```

### Verify No Duplicates

```sql
-- Check that HNW contacts don't exist in both pipelines
WITH hnw_emails AS (
  SELECT email, month FROM raw_contacts
  WHERE workspace_name = 'Kirk Hodgson'
    AND is_high_net_worth = true
)
SELECT
  rc.workspace_name,
  COUNT(*) as duplicate_count
FROM raw_contacts rc
INNER JOIN hnw_emails h ON rc.email = h.email AND rc.month = h.month
WHERE rc.workspace_name != 'Kirk Hodgson'
GROUP BY rc.workspace_name;

-- Should return 0 rows (no duplicates)
```

## Troubleshooting

### HNW Contacts Not Appearing in Kirk's Pipeline

1. **Check Upload Response**
   - Look for: "X HNW Texas contacts moved to Kirk Hodgson"
   - If count is 0, contacts may not meet criteria

2. **Verify Criteria**
   ```sql
   -- Check a specific contact
   SELECT
     first_name, last_name,
     property_state,
     home_value_estimate,
     is_high_net_worth,
     workspace_name
   FROM raw_contacts
   WHERE email = 'test@example.com'
     AND month = '2025-11';
   ```

3. **Check Edge Function Logs**
   - Look for 🎯 emoji: "HNW Candidate: ..."
   - Check Supabase Functions logs for errors

4. **Verify Agency Configuration**
   - Agency must be in TEXAS_AGENCIES list
   - Check `process-contact-upload/index.ts` line 290

### Contacts Appearing in Both Pipelines (Duplicates)

**This should NOT happen with the new logic.**

If it does:
1. Check Edge Function deployment timestamp
2. Verify using latest version (deployed after Oct 14, 2025)
3. Run migration script to fix existing duplicates

### Home Value Not Parsing Correctly

1. **Check CSV Format**
   - Column must be named exactly "Home Value Estimate"
   - Examples of valid formats:
     - `$1,250,000`
     - `1250000`
     - `$850,000.50`

2. **Check Edge Function Logs**
   - Look for: "Parsed home value: $X for email"
   - Look for: "⚠️ Suspicious home value" (if > $100M)

## Retroactive Data Fix

If contacts were uploaded BEFORE October 14, 2025:

**Script:** `scripts/migrate-existing-kim-hnw-to-kirk.ts`

```bash
# Run once to move existing HNW contacts
VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." \
  npx tsx scripts/migrate-existing-kim-hnw-to-kirk.ts
```

This script:
- Finds all HNW Texas contacts in original agency pipelines
- Moves them to Kirk Hodgson (deletes from original)
- Prevents duplicates by checking existing contacts
- Works for both `raw_contacts` and `verified_contacts`

## Testing

### Test Case: New Upload with HNW Split

**Setup:**
1. Create test CSV with:
   - 50 contacts <$900k in Texas
   - 10 contacts ≥$900k in Texas
   - 40 contacts in other states

**Expected Results:**
- Kim Wallace: 90 contacts (50 TX standard + 40 non-TX)
- Kirk Hodgson: 10 contacts (TX HNW only)
- No contact appears in both pipelines

**Verify:**
```sql
-- Should be 0
SELECT COUNT(*) FROM raw_contacts
WHERE email IN (
  SELECT email FROM raw_contacts WHERE workspace_name = 'Kirk Hodgson'
)
AND workspace_name = 'Kim Wallace';
```

## Related Files

- **Edge Function:** `supabase/functions/process-contact-upload/index.ts`
- **Migrations:**
  - `supabase/migrations/20251014000000_add_clean_contact_target.sql`
  - `supabase/migrations/20251014000001_update_pipeline_summary_view.sql`
  - `supabase/migrations/20251014000002_ensure_zip_clients_home_insurance.sql`
- **Migration Script:** `scripts/migrate-existing-kim-hnw-to-kirk.ts`
- **Dashboard:** `src/pages/ContactPipelineDashboard.tsx`

## Manual Database Migrations

**File:** `MANUAL_RUN_contact_pipeline_migrations.sql`

Run this SQL in Supabase SQL Editor to:
1. Add `clean_contact_target` column
2. Update `monthly_contact_pipeline_summary` view
3. Ensure ZIP clients are marked as `home_insurance` type

**Dashboard URL:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql

## Questions?

Contact the development team or check:
- Supabase Dashboard: Functions → process-contact-upload logs
- Database: Tables → raw_contacts, verified_contacts
- Edge Function deployment history

---

**Last Updated:** October 14, 2025
**Feature Status:** ✅ Active & Deployed
**Breaking Change:** Yes - contacts are now MOVED, not duplicated