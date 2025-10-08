# ZIP Code Dashboard + Contact Pipeline Integration

## Overview

The Contact Pipeline and ZIP Code Dashboard are now **fully integrated**. When you upload Cole X Dates CSV files, the system automatically:

1. **Extracts property ZIP codes** from the contact data
2. **Populates the `client_zipcodes` table** with unique ZIPs
3. **Makes ZIPs visible in the ZIP Dashboard** for territory assignment
4. **Links contacts to their territories** for analytics

## How It Works

### Automatic ZIP Code Extraction

When you upload a Cole X Dates CSV via the Contact Pipeline:

```
Cole X Dates CSV Upload
    ↓
process-contact-upload function processes contacts
    ↓
Extracts property_zip + property_state from valid contacts
    ↓
Groups unique ZIP codes
    ↓
Inserts into client_zipcodes table
    ↓
ZIP codes appear in ZIP Dashboard
```

**What Gets Extracted:**
- ✅ Only **property ZIP codes** (not mailing ZIP)
- ✅ Only from **valid contacts** (ready_for_verification status)
- ✅ **Unique ZIPs only** (no duplicates)
- ✅ **State included** for each ZIP
- ✅ **Auto-tagged** with source: "contact_pipeline"

### Example Workflow

**Step 1: Upload Contacts (15th of Month)**
```bash
# User uploads Cole X Dates CSV via Contact Pipeline Dashboard
POST /functions/v1/process-contact-upload
- File: cole_x_dates_november_2025.csv
- Workspace: Danny Schwartz
- Month: 2025-11
```

**Result:**
```json
{
  "summary": {
    "total_contacts": 15000,
    "ready_for_verification": 13500,
    "filtered_out": 1500,
    "unique_zip_codes": 1200,
    "zips_inserted": 1200
  },
  "message": "Processed 15000 contacts: 13500 ready for verification, 1500 filtered out, 1200 ZIP codes added to territory map"
}
```

**Step 2: View in ZIP Dashboard**
```
Navigate to: http://localhost:8081/zip-dashboard
- Month: 2025-11
- See: 1200 new ZIPs for Danny Schwartz
- Status: All unassigned (no agency_color set)
```

**Step 3: Assign Territories**
```
ZIP Dashboard → Assign ZIPs to agencies
- Bulk assign by state
- Individual ZIP assignment
- Set agency colors for visualization
```

**Step 4: Analytics Available**
```
ZIP Dashboard shows:
- Total ZIPs per agency
- Geographic distribution (choropleth map)
- State-level analytics
- Assignment coverage
```

## Database Schema

### `client_zipcodes` Table

```sql
CREATE TABLE public.client_zipcodes (
  id BIGSERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,           -- From client_registry.display_name
  workspace_name TEXT,                 -- From client_registry.workspace_name
  month TEXT NOT NULL,                 -- Processing month (2025-11)
  zip TEXT NOT NULL,                   -- 5-digit ZIP code
  state TEXT,                          -- 2-letter state code
  source TEXT DEFAULT 'csv',           -- 'contact_pipeline' for auto-added
  pulled_at TIMESTAMPTZ DEFAULT NOW(), -- When ZIP was extracted
  agent_run_id UUID,                   -- For manual imports
  inserted_at TIMESTAMPTZ DEFAULT NOW(),
  agency_color TEXT,                   -- Set via ZIP Dashboard

  -- Unique constraint
  CONSTRAINT client_zipcodes_unique
    ON (coalesce(workspace_name, client_name), month, zip)
);
```

### Key Fields

- **`source`**: Set to `'contact_pipeline'` for auto-extracted ZIPs
- **`agency_color`**: NULL initially, set via ZIP Dashboard UI
- **`month`**: Matches the processing month from Contact Pipeline
- **`client_name`**: Display name from client_registry
- **`workspace_name`**: Email Bison workspace name

## Integration Benefits

### 1. **Automatic Territory Discovery**
- No manual ZIP import needed
- ZIPs discovered from actual contact data
- Always aligned with lead generation efforts

### 2. **Month-by-Month Tracking**
- Each month's contacts create new ZIP entries
- Track territory expansion over time
- Compare month-over-month coverage

### 3. **Data Consistency**
- Single source of truth: Cole X Dates CSV
- No manual data entry errors
- Automatic deduplication

### 4. **Agency Assignment**
- Assign ZIPs to specific agencies
- Color-code territories on map
- Track coverage by agency

### 5. **State-Level Analytics**
- Automatic state grouping
- Lead counts per state
- Geographic distribution insights

## Dashboard Features

### ZIP Code Dashboard (`/zip-dashboard`)

**Overview Stats:**
- Total ZIPs (all ZIPs for selected month)
- Assigned ZIPs (have agency_color set)
- Unassigned ZIPs (no agency_color)

**Choropleth Map:**
- Interactive map visualization
- Color-coded by agency
- Click ZIP to assign
- Pan/zoom controls

**State Analytics:**
- Leads per state
- ZIP counts per state
- Top performing states

**Agency Table:**
- ZIPs per agency
- Color picker
- Workspace links

**Filters:**
- Search by ZIP or agency
- Filter by state
- Filter by agency

**Actions:**
- Assign single ZIP
- Bulk assign (upload CSV)
- Add new agency
- Export to CSV

### Contact Pipeline Dashboard (`/contact-pipeline`)

**Shows:**
- Monthly contact targets
- Verified contact counts
- Upload progress
- Weekly batch schedules
- **ZIP code counts** (in upload summary)

## API Integration

### Upload Endpoint Response

```typescript
// POST /functions/v1/process-contact-upload
{
  "success": true,
  "upload_batch_id": "uuid",
  "summary": {
    "total_contacts": 15000,
    "ready_for_verification": 13500,
    "filtered_out": 1500,
    "hnw_contacts": 150,
    "unique_zip_codes": 1200,      // NEW: Total unique ZIPs found
    "zips_inserted": 1200,          // NEW: ZIPs added to client_zipcodes
    "filter_reasons": {...}
  }
}
```

### Querying ZIP Data

```typescript
// Get all ZIPs for a client/month
const { data } = await supabase
  .from('client_zipcodes')
  .select('*')
  .eq('workspace_name', 'Danny Schwartz')
  .eq('month', '2025-11')
  .eq('source', 'contact_pipeline');

// Get unassigned ZIPs
const { data } = await supabase
  .from('client_zipcodes')
  .select('*')
  .eq('month', '2025-11')
  .is('agency_color', null);

// Get ZIPs by agency
const { data } = await supabase
  .from('client_zipcodes')
  .select('*')
  .eq('client_name', 'Agency Name')
  .eq('month', '2025-11')
  .not('agency_color', 'is', null);
```

## Analytics Queries

### ZIPs Per State
```sql
SELECT
  state,
  COUNT(*) as zip_count,
  COUNT(CASE WHEN agency_color IS NOT NULL THEN 1 END) as assigned_count,
  COUNT(CASE WHEN agency_color IS NULL THEN 1 END) as unassigned_count
FROM client_zipcodes
WHERE month = '2025-11'
  AND source = 'contact_pipeline'
GROUP BY state
ORDER BY zip_count DESC;
```

### Agency Territory Coverage
```sql
SELECT
  client_name,
  COUNT(DISTINCT zip) as total_zips,
  COUNT(DISTINCT state) as states_covered,
  MIN(pulled_at) as first_zip_added,
  MAX(pulled_at) as last_zip_added
FROM client_zipcodes
WHERE month = '2025-11'
  AND source = 'contact_pipeline'
  AND agency_color IS NOT NULL
GROUP BY client_name
ORDER BY total_zips DESC;
```

### Month-Over-Month ZIP Growth
```sql
SELECT
  month,
  workspace_name,
  COUNT(DISTINCT zip) as unique_zips,
  COUNT(*) as total_records
FROM client_zipcodes
WHERE source = 'contact_pipeline'
GROUP BY month, workspace_name
ORDER BY month DESC, workspace_name;
```

## Common Workflows

### Workflow 1: New Client Onboarding

1. **Upload first Cole X Dates CSV**
   - Contact Pipeline Dashboard → Upload CSV
   - Client: New Client Name
   - Month: Current month

2. **Review ZIP coverage**
   - ZIP Dashboard → Select current month
   - See all extracted ZIPs

3. **Assign territories**
   - Create agencies in ZIP Dashboard
   - Bulk assign ZIPs by state/region
   - Set agency colors

4. **Monitor expansion**
   - Each subsequent upload adds new ZIPs
   - Track territory growth

### Workflow 2: Monthly Territory Update

1. **15th of month: Upload Cole X Dates**
   - Automatically extracts new ZIPs
   - Adds to client_zipcodes for next month

2. **Review new territories**
   - ZIP Dashboard → Next month
   - Filter: Unassigned ZIPs
   - See expansion areas

3. **Assign new territories**
   - Assign to existing agencies
   - Or create new agencies for new regions

4. **Generate weekly batches**
   - Contact Pipeline processes contacts
   - Weekly uploads to Email Bison

### Workflow 3: State-Level Analysis

1. **View state analytics**
   - ZIP Dashboard → State Leads Analytics section
   - See lead counts per state

2. **Filter by state**
   - Use state filter dropdown
   - Focus on specific region

3. **Assign state-specific agencies**
   - Create agencies per state
   - Color-code by region

4. **Export for reporting**
   - Export CSV with assignments
   - Share with sales team

## Best Practices

### 1. **Monthly ZIP Uploads**
- Upload Cole X Dates CSV on 15th
- Use format: `2025-11` for month
- Check ZIP count in upload summary

### 2. **Territory Assignment**
- Assign territories before weekly uploads
- Use bulk assignment for efficiency
- Keep agency colors consistent

### 3. **Data Consistency**
- Don't manually edit client_zipcodes
- Let Contact Pipeline manage ZIPs
- Use ZIP Dashboard for assignments only

### 4. **Monitoring**
- Check "Unassigned ZIPs" count
- Review new states appearing
- Track month-over-month growth

### 5. **Analytics**
- Use State Analytics section
- Export data for external tools
- Monitor territory coverage

## Troubleshooting

### Issue: ZIPs Not Appearing in ZIP Dashboard

**Check:**
1. Was the CSV upload successful?
2. Were contacts marked as `ready_for_verification`?
3. Did contacts have valid property_zip and property_state?
4. Is the month filter set correctly?

**Solution:**
```sql
-- Check if ZIPs were inserted
SELECT COUNT(*) FROM client_zipcodes
WHERE workspace_name = 'Client Name'
  AND month = '2025-11'
  AND source = 'contact_pipeline';

-- If 0, check raw_contacts
SELECT COUNT(DISTINCT property_zip) FROM raw_contacts
WHERE workspace_name = 'Client Name'
  AND month = '2025-11'
  AND processing_status = 'ready_for_verification'
  AND property_zip IS NOT NULL;
```

### Issue: Duplicate ZIPs

**This is normal!** The system uses `UPSERT` with conflict resolution.

```sql
-- Check for duplicates (shouldn't find any)
SELECT zip, state, COUNT(*) as count
FROM client_zipcodes
WHERE month = '2025-11'
  AND workspace_name = 'Client Name'
GROUP BY zip, state
HAVING COUNT(*) > 1;
```

### Issue: Wrong Client Name on ZIPs

**Cause:** ZIPs are tagged with `client_registry.display_name`

**Solution:**
```sql
-- Update client display name
UPDATE client_registry
SET display_name = 'Correct Name'
WHERE workspace_name = 'Workspace Name';

-- Re-upload CSV to get correct name on new ZIPs
-- (Old ZIPs keep old name - this is by design)
```

### Issue: ZIPs Showing Wrong Month

**Cause:** Month parameter in upload didn't match intent

**Solution:**
```sql
-- Move ZIPs to correct month (if needed)
UPDATE client_zipcodes
SET month = '2025-12'
WHERE month = '2025-11'
  AND workspace_name = 'Client Name'
  AND source = 'contact_pipeline';
```

## Future Enhancements

### Phase 1: Auto-Territory Assignment
- AI-based ZIP assignment recommendations
- Historic data analysis
- Geographic clustering

### Phase 2: Lead Density Heatmap
- Overlay lead counts on map
- Identify high-value territories
- Optimize agency assignments

### Phase 3: Performance Analytics
- Response rates by territory
- ROI per ZIP code
- Territory effectiveness scoring

### Phase 4: Predictive Analytics
- Forecast next month's ZIPs
- Identify expansion opportunities
- Territory growth predictions

## Summary

The Contact Pipeline and ZIP Dashboard are now **seamlessly integrated**:

✅ **Automatic ZIP extraction** from Cole X Dates uploads
✅ **Real-time territory mapping** in ZIP Dashboard
✅ **Agency assignment** and color-coding
✅ **State-level analytics** and insights
✅ **Month-by-month tracking** of territory growth
✅ **Export capabilities** for reporting

**One upload = Complete territory visibility**

No manual ZIP imports needed. No data entry errors. Just upload your monthly Cole X Dates CSV and watch the territory map populate automatically! 🗺️

---

**For detailed Contact Pipeline usage:** See [CONTACT_PIPELINE_GUIDE.md](./CONTACT_PIPELINE_GUIDE.md)
**For ZIP Dashboard help:** Visit `/zip-dashboard` in your app
