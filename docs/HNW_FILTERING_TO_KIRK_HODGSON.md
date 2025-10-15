# High Net Worth Contact Filtering to Kirk Hodgson

## Overview

All high net worth (HNW) contacts with home values ≥$750,000 from Texas agencies are automatically duplicated to Kirk Hodgson's pipeline. This ensures Kirk receives qualified HNW leads while the original agencies still maintain their own copies.

## How It Works

### Automatic Filtering (Contact Upload)

When contacts are uploaded for any Texas agency through the Contact Pipeline Dashboard:

1. **CSV Upload** → The `process-contact-upload` Edge Function processes the CSV
2. **HNW Detection** → Contacts with `property_state = 'TX'` AND `home_value_estimate >= $750,000` are flagged as HNW
3. **Automatic Duplication** → HNW contacts are automatically copied to Kirk Hodgson's workspace
4. **Both Pipelines Updated** → Contacts appear in both the original agency's pipeline AND Kirk Hodgson's pipeline

### Texas Agencies

The following agencies have HNW filtering enabled:
- **Kim Wallace**
- **David Amiri**
- **John Roberts**
- **Jason Binyon**

### Threshold

- **HNW Threshold:** ≥$750,000 home value
- **Geographic Filter:** Texas (TX) only
- **Contact Type:** Head of household with valid email

## Implementation Details

### Database Tables

Contacts flow through two main tables:

1. **`raw_contacts`** - Initial upload, before email verification
   - HNW contacts are duplicated here immediately after upload
   - Tagged with `is_high_net_worth = true`
   - Kirk's copies have `uploaded_by = 'hnw_auto_route_from_{original_workspace}'`

2. **`verified_contacts`** - After Debounce email verification
   - HNW contacts pass through verification independently for each workspace
   - Kirk's contacts are tagged with `target_campaign = 'HNW Evergreen'`

### Edge Function Updates

**File:** `supabase/functions/process-contact-upload/index.ts`

Key changes:
- Updated HNW threshold from $900k → $750k (lines 123)
- Added automatic duplication logic after initial insert (lines 287-341)
- Returns `kirk_routing_count` in response summary

### Retroactive Filtering

For contacts uploaded BEFORE this feature was implemented:

**Script:** `scripts/retroactive-hnw-filtering-to-kirk.ts`

```bash
# Run this script to copy existing HNW contacts to Kirk
VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." npx tsx scripts/retroactive-hnw-filtering-to-kirk.ts
```

This script:
- Scans all Texas agencies for existing HNW contacts
- Checks for duplicates (by email + month)
- Copies new HNW contacts to Kirk Hodgson's pipeline
- Works for both `raw_contacts` and `verified_contacts`

## Contact Pipeline Dashboard

### Kim Wallace View (Example)
```
Client: Kim Wallace
Month: November 2025
Total Contacts: 10,000
└─ Texas Contacts: 3,500
   └─ HNW (≥$750k): 250 contacts
```

### Kirk Hodgson View
```
Client: Kirk Hodgson (HNW Receiver)
Month: November 2025
Total Contacts: 1,200
└─ From Kim Wallace: 250
└─ From David Amiri: 180
└─ From John Roberts: 420
└─ From Jason Binyon: 350
```

## Upload Workflow

### When Kim Wallace Uploads Contacts for November:

1. **Upload CSV** via Contact Pipeline Dashboard
2. **Processing:**
   ```
   Total contacts: 10,000
   ├─ Filtered out: 1,500 (not head of household, invalid email, etc.)
   ├─ Ready for verification: 8,500
   │  ├─ Standard contacts: 8,250
   │  └─ HNW Texas contacts: 250
   └─ Kirk Hodgson routing: 250 HNW contacts auto-copied
   ```
3. **Result:**
   - Kim Wallace has 8,500 contacts in pipeline
   - Kirk Hodgson receives 250 HNW contacts automatically
   - Both go through verification independently

## Verification & Upload to Email Bison

HNW contacts in Kirk's pipeline:
- Go through Debounce verification separately
- Are organized into weekly batches
- Upload to Email Bison as "HNW Evergreen" campaign
- Track separately in weekly upload status

## Monitoring & Reports

### Check Kirk's HNW Pipeline

```sql
-- Current month HNW contacts for Kirk
SELECT
  month,
  COUNT(*) as total_hnw_contacts,
  COUNT(*) FILTER (WHERE is_uploaded = false) as pending_upload
FROM verified_contacts
WHERE workspace_name = 'Kirk Hodgson'
  AND month = '2025-11'
  AND is_high_net_worth = true
GROUP BY month;
```

### View HNW Routing Summary

```sql
-- See HNW contacts by source agency
SELECT * FROM hnw_routing_summary;
```

### Audit HNW Routing

```sql
-- Check which contacts were auto-routed
SELECT
  upload_batch_id,
  uploaded_by,
  COUNT(*) as contacts
FROM raw_contacts
WHERE workspace_name = 'Kirk Hodgson'
  AND uploaded_by LIKE 'hnw_auto_route_from_%'
GROUP BY upload_batch_id, uploaded_by
ORDER BY created_at DESC;
```

## Troubleshooting

### HNW Contacts Not Appearing in Kirk's Pipeline

1. **Check Upload Response**
   - Upload response includes `kirk_routing_count`
   - Should show: "X HNW Texas contacts automatically routed to Kirk Hodgson"

2. **Verify Agency Configuration**
   - Agency must be in TEXAS_AGENCIES list
   - Check `process-contact-upload/index.ts` line 291

3. **Check Contact Criteria**
   - Must have `property_state = 'TX'`
   - Must have `home_value_estimate >= 750000`
   - Must pass other filters (head of household, valid email, etc.)

4. **Run Retroactive Script**
   - If contacts were uploaded before this feature was deployed
   - Use `scripts/retroactive-hnw-filtering-to-kirk.ts`

### Duplicate Prevention

The system prevents duplicates using:
- Email + Month combination (unique constraint)
- Pre-insert duplicate check in retroactive script
- Separate batch IDs for Kirk's copies

## Future Enhancements

Potential improvements:
1. **Dashboard Visibility** - Show source agency in Kirk's contact view
2. **Configurable Threshold** - Make $750k threshold adjustable per agency
3. **Additional States** - Extend HNW filtering to other states
4. **Audit Trail** - Enhanced tracking of contact routing history
5. **Slack Notifications** - Alert Kirk when new HNW batches arrive

## Related Files

- **Edge Function:** `supabase/functions/process-contact-upload/index.ts`
- **Retroactive Script:** `scripts/retroactive-hnw-filtering-to-kirk.ts`
- **Migration:** `supabase/migrations/20251010150000_add_zip_pipeline_tracking.sql`
- **Dashboard:** `src/pages/ContactPipelineDashboard.tsx`

## Questions?

Contact the development team or check:
- Supabase Dashboard: Functions → process-contact-upload logs
- Database: Tables → raw_contacts, verified_contacts
- Views: hnw_routing_summary

---

**Last Updated:** October 2025
**Feature Status:** ✅ Active & Deployed
