# KPI Goal Discrepancy Resolution

**Date:** November 17, 2025
**Issue:** KPI Dashboard total goal changing between 1500 and 1850
**Status:** ✅ **RESOLVED**

---

## Executive Summary

The KPI Dashboard was showing inconsistent goal totals (1500 today vs 1850 last week) due to **whitelist name mismatches**. Two client names in the hardcoded whitelist didn't match their database names, causing a 350-point discrepancy.

**Root Cause:** Whitelist contained:
- `'Nicholas Sakha'` → Database has `'Nick Sakha'` (KPI: 300)
- `'SMA Insurance Services'` → Database has `'SMA Insurance'` (KPI: 50)
- **Total missing:** 300 + 50 = 350 ✅

**Fix Applied:** Updated [KPIDashboard.tsx:58-59](src/pages/KPIDashboard.tsx#L58-L59) to use correct client names.

---

## Single Source of Truth

### Primary Data Source
**Table:** `client_registry`
**Column:** `monthly_kpi_target` (INTEGER)
**Location:** Supabase production database

### How Values are Set
- **Manual configuration** via:
  - ClientProfile.tsx UI (line 241)
  - ClientManagement.tsx when adding new clients (line 93)
  - Direct SQL migrations (for bulk updates)

### What It Represents
- Static monthly KPI target per client
- NOT automatically calculated or pro-rated
- NOT affected by days remaining in month
- Only changes when manually updated

---

## Dashboard Filtering Architecture

### 1. KPI Dashboard

**File:** [src/pages/KPIDashboard.tsx](src/pages/KPIDashboard.tsx#L51-L66)

**Filtering Layers:**
1. **Database Filter:** `.eq('is_active', true)` (line 63 in realtimeDataService.ts)
2. **Frontend Whitelist:** 14 specific clients (lines 51-66)

**Whitelist (After Fix):**
```typescript
const KPI_DASHBOARD_CLIENTS = [
  'David Amiri',
  'Danny Schwartz',
  'Devin Hodo',
  'StreetSmart Commercial',
  'Kim Wallace',
  'Jason Binyon',
  'Nick Sakha',           // ✅ Fixed: was 'Nicholas Sakha'
  'SMA Insurance',        // ✅ Fixed: was 'SMA Insurance Services'
  'John Roberts',
  'Rob Russell',
  'Kirk Hodgson',
  'Gregg Blanchard',
  'Jeff Schroder',
  'Tony Schmitz'
];
```

**Aggregation Logic:**
```typescript
// Line 74-81
const aggregateMetrics = displayedClients.reduce(
  (acc, client) => ({
    totalTarget: acc.totalTarget + client.monthlyKPI,  // ← This sums monthly_kpi_target
    // ...
  }),
  { totalTarget: 0 }
);
```

**Result After Fix:** Total = **1850** (14 active clients)

---

### 2. Volume Dashboard

**File:** [src/pages/VolumeDashboard.tsx](src/pages/VolumeDashboard.tsx)

**Filtering Layers:**
1. **Database Filter:** `.eq('is_active', true)` (line 208 in realtimeDataService.ts)
2. **Frontend Blacklist:** Excludes 9 specific clients (clientFilters.ts lines 11-21)

**Blacklist:**
```typescript
export const VOLUME_DASHBOARD_BLACKLIST = [
  'Maverick In-house',
  'LongRun',
  'Koppa Analytics',
  'Boring Book Keeping',
  'Radiant Energy',
  'Shane Miller',
  'ATI',
  'Ozment Media',
  'Littlegiant',
];
```

**Result:** Shows all active clients EXCEPT blacklisted ones

---

### 3. Revenue Dashboard

**File:** [src/pages/RevenueDashboard.tsx](src/pages/RevenueDashboard.tsx)

**Filtering:**
- **Single Filter:** `.eq('is_active', true)` (line 157 in revenue-analytics/index.ts)
- **No whitelist or blacklist**

**Result:** Shows ALL active clients with revenue data

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ DATABASE: client_registry                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ workspace_name         | monthly_kpi_target | is_active │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Nick Sakha            │ 300                │ true      │ │
│ │ SMA Insurance         │ 50                 │ true      │ │
│ │ David Amiri           │ 100                │ true      │ │
│ │ ... (11 more)         │ ...                │ ...       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ▼
        ┌──────────────────────────────────────┐
        │ realtimeDataService.ts               │
        │ Filter: .eq('is_active', true)       │
        └──────────────────────────────────────┘
                            ▼
        ┌─────────────────┬────────────────────┬──────────────────┐
        │                 │                    │                  │
    ┌───▼────┐      ┌─────▼──────┐      ┌─────▼─────┐
    │  KPI   │      │   Volume   │      │  Revenue  │
    │Dashboard│      │  Dashboard │      │ Dashboard │
    └────────┘      └────────────┘      └───────────┘
        │                 │                    │
    Whitelist        Blacklist            No Filter
    14 clients       (exclude 9)         (all active)
        │                 │                    │
        ▼                 ▼                    ▼
    Total: 1850      Total: varies        Total: varies
```

---

## Why the Goal Changed (Timeline)

### Scenario Reconstruction

**Last Week (Goal = 1850):**
- Whitelist had correct names OR clients were renamed recently
- All 14 clients matched database
- Nick Sakha (300) + SMA Insurance (50) = included
- **Total:** 1850

**Today (Goal = 1500):**
- Whitelist had wrong names:
  - 'Nicholas Sakha' ≠ 'Nick Sakha' → NOT matched
  - 'SMA Insurance Services' ≠ 'SMA Insurance' → NOT matched
- Only 12 clients matched database
- **Total:** 1500 (1850 - 350)

**After Fix (Goal = 1850):**
- Whitelist names corrected to match database
- All 14 clients matched again
- **Total:** 1850 ✅

---

## Validation Results

### Pre-Fix Investigation
```
📋 Clients in whitelist:          14
📊 Clients found in database:     12  ❌
⚠️  Missing clients:
  ✗ Nicholas Sakha
  ✗ SMA Insurance Services

Total Active KPI Target:          1500
```

### Post-Fix Verification
```
📋 Clients in whitelist:          14
📊 Clients found in database:     14  ✅
✅ All whitelist clients found!

Total Active KPI Target:          1850

🎯 KEY CLIENTS NOW INCLUDED:
  ✅ Nick Sakha:      KPI 300, Active: true
  ✅ SMA Insurance:   KPI 50,  Active: true

Combined: 350 (exact difference explained!)
```

---

## Database Schema Reference

### client_registry Table
```sql
CREATE TABLE client_registry (
  workspace_id INTEGER PRIMARY KEY,
  workspace_name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  monthly_kpi_target INTEGER DEFAULT 0,  -- ← Source of truth for KPI goals
  is_active BOOLEAN DEFAULT true,        -- ← Primary filter for all dashboards
  billing_type TEXT CHECK (billing_type IN ('per_lead', 'retainer')),
  price_per_lead NUMERIC(10, 2),
  retainer_amount NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Points:**
- `monthly_kpi_target` is manually configured per client
- `is_active` determines if client appears in ANY dashboard
- `workspace_name` must exactly match KPI Dashboard whitelist

---

## Current State (As of Fix)

### All Clients with KPI Targets (Active)

| Client Name            | KPI Target | Status  | In KPI Dashboard |
|------------------------|------------|---------|------------------|
| David Amiri            | 100        | Active  | ✅               |
| Danny Schwartz         | 100        | Active  | ✅               |
| Devin Hodo            | 100        | Active  | ✅               |
| StreetSmart Commercial | 50         | Active  | ✅               |
| Kim Wallace            | 200        | Active  | ✅               |
| Jason Binyon           | 200        | Active  | ✅               |
| **Nick Sakha**         | **300**    | Active  | ✅ **FIXED**     |
| **SMA Insurance**      | **50**     | Active  | ✅ **FIXED**     |
| John Roberts           | 100        | Active  | ✅               |
| Rob Russell            | 100        | Active  | ✅               |
| Kirk Hodgson           | 50         | Active  | ✅               |
| Gregg Blanchard        | 100        | Active  | ✅               |
| Jeff Schroder          | 100        | Active  | ✅               |
| Tony Schmitz           | 300        | Active  | ✅               |
| **TOTAL**              | **1850**   |         |                  |

### Other Active Clients (Not in KPI Dashboard)

| Client Name           | KPI Target | Status  | In KPI Dashboard |
|-----------------------|------------|---------|------------------|
| StreetSmart P&C      | 100        | Active  | ❌               |
| StreetSmart Trucking | 100        | Active  | ❌               |
| ATI                  | 0          | Active  | ❌               |
| Boring Book Keeping  | 0          | Active  | ❌               |
| ... (11 more)        | ...        | Active  | ❌               |

**Total All Active Clients:** 2050

---

## Future Recommendations

### 1. ✅ **IMMEDIATE FIX APPLIED**
- Updated whitelist names to match database
- Verified all 14 clients now included
- Total goal restored to 1850

### 2. **PREVENT FUTURE NAME MISMATCHES**
- Consider fetching whitelist from database instead of hardcoding
- Add validation to warn when whitelist names don't match database
- Create migration file for any future name changes

### 3. **IMPROVE VISIBILITY**
- Add indicator showing which clients are filtered out
- Display count: "Showing 14 of 25 active clients"
- Show warning if whitelist contains non-existent clients

### 4. **AUDIT LOGGING**
- Track when `monthly_kpi_target` values change
- Track when `is_active` status changes
- Log who made the changes and when

### 5. **DOCUMENTATION**
- Update onboarding docs to explain filtering rules
- Document the difference between KPI, Volume, and Revenue dashboards
- Clarify when to use `is_active = false` vs deleting a client

---

## Files Modified

### ✅ Fixed
- [src/pages/KPIDashboard.tsx](src/pages/KPIDashboard.tsx#L58-L59) - Corrected whitelist names

### 📄 Created for Investigation
- `scripts/investigate-kpi-goal-discrepancy.ts` - Investigation script
- `scripts/find-missing-clients.ts` - Client name search
- `scripts/verify-kpi-fix.ts` - Verification script
- `KPI_GOAL_DISCREPANCY_RESOLUTION.md` - This documentation

---

## Testing Instructions

### 1. Verify Fix in Browser
1. Refresh the KPI Dashboard page
2. Check the total goal in the top cards
3. **Expected:** Should show **1850** (not 1500)
4. Verify Nick Sakha and SMA Insurance cards appear

### 2. Verify Database Consistency
```bash
# Run verification script
VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." npx tsx scripts/verify-kpi-fix.ts
```

**Expected Output:**
```
✅ All whitelist clients found in database!
Total Active KPI Target: 1850
✅ SUCCESS! The fix restores the correct total of 1850.
```

### 3. Verify Revenue Dashboard
1. Navigate to Revenue Dashboard
2. Check that revenue calculations include all active clients
3. **Expected:** Should show data for ALL active clients (not just the 14 in KPI whitelist)

---

## Support

If the total goal changes again in the future:

1. **Check `is_active` status:**
   ```sql
   SELECT workspace_name, monthly_kpi_target, is_active
   FROM client_registry
   WHERE workspace_name IN ('Nick Sakha', 'SMA Insurance', ...)
   ORDER BY workspace_name;
   ```

2. **Verify whitelist matches database:**
   ```bash
   npx tsx scripts/verify-kpi-fix.ts
   ```

3. **Check for recent name changes:**
   ```sql
   SELECT workspace_name, updated_at
   FROM client_registry
   WHERE updated_at > NOW() - INTERVAL '7 days'
   ORDER BY updated_at DESC;
   ```

---

## Conclusion

✅ **Issue Resolved:** KPI Dashboard now shows correct total of 1850
✅ **Root Cause:** Whitelist name mismatches (Nicholas → Nick, SMA Insurance Services → SMA Insurance)
✅ **Single Source of Truth:** `client_registry.monthly_kpi_target` with `is_active = true` filter
✅ **Verified:** All 14 whitelisted clients now matched and included

**Next Steps:** Monitor dashboard after page refresh to ensure consistency, then optionally implement the future recommendations for improved robustness.
