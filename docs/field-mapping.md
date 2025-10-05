# Airtable Field Mapping Guide

**Purpose**: Maps Airtable fields to dashboard components and Edge Functions

**Last Updated**: October 2, 2025

---

## Table of Contents
1. [KPI Dashboard](#kpi-dashboard)
2. [Volume Dashboard](#volume-dashboard)
3. [Billing Dashboard](#billing-dashboard)
4. [Field Standardization](#field-standardization)
5. [Data Source Priority](#data-source-priority)

---

## KPI Dashboard

**Page**: `src/pages/KPIDashboard.tsx`
**Edge Function**: `supabase/functions/hybrid-workspace-analytics/index.ts`
**Primary Data Source**: Airtable (👨‍💻 Clients table)
**Supplemental Data Source**: Email Bison API

### Field Mappings

| Dashboard Property | Airtable Field | Type | Notes |
|-------------------|----------------|------|-------|
| `name` | `Client Company Name` | Single Line Text | Primary client identifier |
| `id` | `Airtable ID` (Record ID) | Formula | Unique record identifier |
| `leadsGenerated` | `Positive Replies MTD` ⚠️ | Count | **CORRECTED**: Was using `Positive Replies Current Month` |
| `monthlyKPI` | `Monthly KPI` | Number | Target positive replies per month |
| `projectedReplies` | `Projection: Positive Replies Received (by EOM)` | Formula | Projected end-of-month total |
| `currentProgress` | `MTD - Leads Generated Progress` | Formula (%) | Returns decimal (0.75 = 75%) |
| `repliesProgress` | `Projection Positive Replies % Progress` | Formula (%) | Returns decimal |
| `positiveRepliesLast30Days` | `Positive Replies Last 30 Days` | Count | Rolling 30-day window |
| `positiveRepliesLast7Days` | `Positive Replies Last 7 Days` | Count | Last 7 days |
| `positiveRepliesLast14Days` | `Positive Replies Last 14-7 Days` | Count | Days 14-7 ago |
| `positiveRepliesCurrentMonth` | `Positive Replies Current Month` | Count | Current calendar month |
| `positiveRepliesLastMonth` | `Positive Replies Last Month` | Count | Previous calendar month |
| `lastWeekVsWeekBeforeProgress` | `Last Week VS Week Before Positive Replies % Progress` | Formula (%) | Week-over-week growth |
| `positiveRepliesLastVsThisMonth` | `Positive Replies Last VS This Month` | Formula | Month-over-month % (returns number) |

### Email Bison Supplemental Fields

| Dashboard Property | Email Bison API Field | Source |
|-------------------|----------------------|--------|
| `emailsSent` | `emails_sent` | Workspace stats endpoint |
| `bounced` | `bounced` | Workspace stats endpoint |
| `interested` | `interested` | Workspace stats endpoint |

### Components Using This Data

**Overview Cards**:
- `ClientOverviewCard.tsx` - Shows `leadsGenerated`, `monthlyKPI`, `currentProgress`, `projectedReplies`
- `ClientPerformanceLists.tsx` - Filters clients into Above Target / On Track / Below Target

**Detail View**:
- `KPICard.tsx` - Individual metric cards
- `ProgressPieChart.tsx` - Uses `repliesProgress`
- `RepliesTimelineView.tsx` - Uses all time period fields
- `ComparisonMetrics.tsx` - Week/month comparisons

### Logic

**Above Target**: `leadsGenerated >= monthlyKPI` (current positive replies meet or exceed target)

**On Track**: `leadsGenerated < monthlyKPI` AND `projectedReplies >= monthlyKPI` (not there yet, but projected to hit)

**Below Target**: `projectedReplies < monthlyKPI` (projected to miss target)

### Critical Fix Applied

**Problem**: Kirk Hodgson showing 9 leads for October when should be 0

**Root Cause**:
- Was using `Positive Replies Current Month` field
- This field appears to be rolling or not resetting properly
- Should use `Positive Replies MTD` which resets on 1st of month

**Fix**: Changed line 215 in `hybrid-workspace-analytics/index.ts`
```typescript
// BEFORE:
leadsGenerated: positiveRepliesCurrentMonth,

// AFTER:
leadsGenerated: positiveRepliesMTD, // Use MTD (resets each month)
```

**Status**: ⏳ Pending deployment and verification

---

## Volume Dashboard

**Page**: `src/pages/VolumeDashboard.tsx`
**Edge Function**: `supabase/functions/hybrid-workspace-analytics/index.ts`
**Primary Data Source**: Email Bison API (real-time)
**Supplemental Data Source**: Airtable (👨‍💻 Clients table)

### Field Mappings

| Dashboard Property | Airtable Field | Type | Used For |
|-------------------|----------------|------|----------|
| `target` | `Monthly Sending Target` | Number | Volume target per month |
| `payout` | `Payout` | Currency | Performance payout |
| `emails` | N/A - from Email Bison | API | Real-time emails sent |
| `projection` | `Projection: Emails Sent by EOM` | Formula | Projected end-of-month volume |

### Calculations

```typescript
targetPercentage = (emails / target) * 100
projectedPercentage = (projection / target) * 100
variance = emails - target
projectedVariance = projection - target
isAboveTarget = emails >= target
isProjectedAboveTarget = projection >= target
```

---

## Billing Dashboard

**Page**: `src/pages/BillingPage.tsx`
**Edge Function**: `supabase/functions/hybrid-workspace-analytics/index.ts`
**Primary Data Source**: Airtable (👨‍💻 Clients table)

### Field Mappings

| Dashboard Property | Airtable Field | Type | Notes |
|-------------------|----------------|------|-------|
| `name` | `Client Company Name` | Single Line Text | Client name |
| `monthlyKPI` | `Monthly KPI` | Number | Target positive replies |
| `positiveRepliesMTD` | `Positive Replies MTD` | Count | Current month replies |
| `pricePerLead` | Calculated (manual or formula) | Currency | Revenue per lead |
| `monthlyRevenue` | `Retainer` + `Payout` | Calculated | Total monthly revenue |

### Revenue Calculation

```typescript
monthlyRevenue = retainer + (positiveRepliesMTD * pricePerLead)
```

---

## Field Standardization

### Recommended Standard Client Data Model

Every client record should have these **core fields** consistently mapped across all dashboards:

#### Identity
- ✅ `Client Company Name` - Primary identifier
- ✅ `Airtable ID` - Unique ID
- ✅ `Workspace Name` - Email Bison workspace name (must match exactly)

#### Volume Metrics
- ✅ `Monthly Sending Target` - Target emails per month
- ✅ Emails Sent (from Email Bison API) - Real-time actual
- ✅ `Projection: Emails Sent by EOM` - Projected volume

#### Performance Metrics
- ✅ `Monthly KPI` - Target positive replies
- ✅ `Positive Replies MTD` - **PRIMARY** source for current month count
- ✅ `Projection: Positive Replies Received (by EOM)` - Projected replies
- ✅ `MTD - Leads Generated Progress` - Progress percentage (0-1)
- ✅ `Projection Positive Replies % Progress` - Projected progress

#### Time Period Aggregations
- ✅ `Positive Replies Last 7 Days` - Last 7 days
- ✅ `Positive Replies Last 14-7 Days` - Previous week
- ✅ `Positive Replies Last 30 Days` - Rolling 30 days
- ✅ `Positive Replies Current Month` - Current calendar month (backup/comparison)
- ✅ `Positive Replies Last Month` - Previous calendar month

#### Revenue
- ✅ `Retainer` - Monthly retainer
- ✅ `Payout` - Performance payout
- ⚠️ Price per lead (not currently in Airtable, should add)

### Naming Convention Rules

**For Time-Based Count Fields**:
```
[Metric] + [Time Period]

Examples:
- Positive Replies MTD
- Positive Replies Last 7 Days
- Emails Sent - Current Month
```

**For Formula Fields (Calculated)**:
```
[Calculation Type]: [Metric]

Examples:
- Projection: Positive Replies Received (by EOM)
- MTD - Leads Generated Progress
```

**For Linked/Lookup Fields**:
```
[Field Name] (from [Table Name])

Examples:
- Client Name (from Client)
- Campaign Name (from Campaign Linked)
```

---

## Data Source Priority

### Hierarchy for Conflicting Data

When multiple sources provide the same metric, use this priority:

**1. Real-Time Metrics** (volume, sends, bounces):
- **PRIMARY**: Email Bison API (live data)
- **BACKUP**: Airtable (may be delayed or calculated)

**2. KPI Metrics** (positive replies, targets):
- **PRIMARY**: Airtable (source of truth for manual targets and filtered counts)
- **VALIDATION**: Email Bison API (cross-check for discrepancies)

**3. Historical Data** (trends, comparisons):
- **PRIMARY**: Airtable (has time-filtered count fields)
- **SUPPLEMENT**: Email Bison API with date ranges

### Filter Logic: Active Clients Only

**Requirement**: Only show clients who have BOTH:
1. ✅ Record in Airtable "👨‍💻 Clients" table
2. ✅ Active workspace in Email Bison

**Implementation** (in `hybrid-workspace-analytics/index.ts`):
```typescript
const clients = allClientRecords
  .filter((record: any) => {
    const clientName = record.fields['Client Company Name'];
    const hasWorkspace = clientName && workspaceStatsMap.has(clientName);
    if (!hasWorkspace && clientName) {
      console.log(`Filtering out client "${clientName}" - no Email Bison workspace found`);
    }
    return hasWorkspace;
  })
```

**Reason**: Clients without workspaces cannot send emails, so they shouldn't appear in performance dashboards.

---

## Validation Checklist

### Monthly Data Validation (Run on 1st of each month)

- [ ] Verify `Positive Replies MTD` resets to 0 for all clients
- [ ] Verify `Positive Replies Current Month` resets to 0
- [ ] Cross-check Airtable MTD counts vs. Email Bison API
- [ ] Confirm `Projection` formulas are calculating correctly
- [ ] Check for any clients in Email Bison not in Airtable
- [ ] Check for any clients in Airtable without Email Bison workspaces

### Field Mapping Verification

- [ ] All dashboards using standardized field names
- [ ] No hardcoded field name variations
- [ ] Edge Functions using correct Airtable field names (exact spelling)
- [ ] TypeScript interfaces match Airtable field structure

---

## Known Discrepancies & Resolutions

### 1. MTD vs Current Month

**Issue**: Two similar fields exist with different values
- `Positive Replies MTD`
- `Positive Replies Current Month`

**Analysis**:
- Both are **Count fields** that count linked records from Positive Replies table
- MTD likely filters on `Received - MTD` formula field
- Current Month likely filters on different date logic

**Resolution**: ✅ Use `Positive Replies MTD` as primary source

**Why**: "MTD" (Month-to-Date) is standard business terminology and should reset on 1st of month

### 2. Progress Percentage Format

**Issue**: Some progress values were being divided by 100 incorrectly

**Analysis**:
- Airtable formulas for progress return **decimal** format (0.75 = 75%)
- Code was dividing by 100 again (0.75 / 100 = 0.0075 = 0.75%)

**Resolution**: ✅ Do NOT divide Airtable percentage fields by 100
```typescript
// CORRECT:
currentProgress: mtdProgress, // Already a decimal/percentage from Airtable

// WRONG:
currentProgress: mtdProgress / 100, // Would make 75% become 0.75%
```

### 3. Projected vs Actual Emails Sent

**Issue**: Volume dashboard shows both projected and actual

**Analysis**:
- **Actual**: Real-time from Email Bison API
- **Projected**: Calculated in Airtable based on current pace

**Resolution**: ✅ Clearly label which is which in UI

---

## Edge Function Field Extraction Examples

### Correct Pattern

```typescript
// Extract from Airtable record
const airtableData = record.fields;

// Primary KPI metrics (use exact Airtable field names)
const positiveRepliesMTD = airtableData['Positive Replies MTD'] || 0;
const monthlyKPI = airtableData['Monthly KPI'] || 0;
const mtdProgress = airtableData['MTD - Leads Generated Progress'] || 0;

// Time period metrics
const positiveRepliesLast7Days = airtableData['Positive Replies Last 7 Days'] || 0;

// Map to dashboard-friendly property names
return {
  leadsGenerated: positiveRepliesMTD,  // Rename for clarity
  monthlyKPI: monthlyKPI,              // Keep name
  currentProgress: mtdProgress,        // Rename for clarity
  positiveRepliesLast7Days,            // Use same name
};
```

### Common Mistakes to Avoid

❌ **Wrong field name** (typo or variation):
```typescript
const mtd = airtableData['Positive Replies - MTD'] || 0; // Dash instead of space
```

❌ **Assuming field returns wrong type**:
```typescript
const progress = parseFloat(airtableData['MTD - Leads Generated Progress']) / 100;
// Already a decimal, don't divide by 100!
```

❌ **Not handling missing fields**:
```typescript
const kpi = airtableData['Monthly KPI']; // Could be undefined
// Better:
const kpi = airtableData['Monthly KPI'] || 0;
```

---

## Future Improvements

### Recommended Airtable Schema Changes

1. **Add `Price Per Lead` field** to Clients table
   - Type: Currency
   - Used for: Billing revenue calculations

2. **Consolidate duplicate fields**:
   - Keep: `Positive Replies MTD`
   - Evaluate: `Positive Replies Current Month` (remove if truly redundant)

3. **Add validation formulas**:
   - Alert if MTD count doesn't match API count (discrepancy check)
   - Alert if workspace name doesn't exist in Email Bison

4. **Standardize date filtering**:
   - Document exact formula logic for each time period field
   - Ensure consistent "reset" behavior for MTD fields

### Recommended Code Improvements

1. **Type safety**: Create strict TypeScript interfaces matching Airtable schema
2. **Validation**: Add runtime checks that required fields exist before mapping
3. **Logging**: Add debug logging showing field values being extracted
4. **Error handling**: Gracefully handle missing or malformed Airtable data
5. **Caching**: Cache Airtable schema to avoid repeated Meta API calls

---

## Testing & Verification

### Test Cases

**Test 1: Kirk Hodgson October Data**
- ✅ Query Airtable API for Kirk Hodgson record
- ✅ Check `Positive Replies MTD` value (should be 0 for October)
- ✅ Check `Positive Replies Current Month` value
- ✅ Deploy fix using MTD field
- ⏳ Verify dashboard shows 0

**Test 2: Cross-Reference Airtable vs Email Bison**
- Pick 3 random clients
- Get MTD count from Airtable
- Get interested/positive count from Email Bison API for current month
- Compare - should match or have documented reason for difference

**Test 3: Monthly Reset**
- On Oct 1st, verify all MTD fields = 0
- On Oct 2nd, verify counts are accurate for Oct 1st data

### Monitoring

**Dashboard Health Checks**:
- [ ] All clients with workspaces appear in KPI Dashboard
- [ ] No clients without workspaces appear
- [ ] Progress percentages display correctly (not negative, not > 100% unless over-delivering)
- [ ] Projections are reasonable (not 0, not absurdly high)
- [ ] Month-over-month comparisons show expected trends

---

## Summary

**Key Takeaways**:
1. ✅ Use `Positive Replies MTD` as primary source for current month count
2. ✅ Do NOT divide Airtable percentage fields by 100
3. ✅ Filter to only show clients with Email Bison workspaces
4. ✅ Email Bison API is primary for real-time volume, Airtable is primary for KPIs
5. ✅ Exact field name spelling matters (spaces, capitalization, emojis)
6. ⏳ Monthly validation on 1st of month to ensure MTD fields reset
7. ⏳ Deploy fix for Kirk Hodgson data and verify

**Next Actions**:
1. Deploy updated Edge Function with MTD field fix
2. Test Kirk Hodgson shows 0 for October
3. Add monthly validation automation
4. Document any remaining field formula logic
