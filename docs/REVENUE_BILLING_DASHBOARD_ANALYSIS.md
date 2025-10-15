# Revenue & Billing Dashboard Analysis

**Date:** October 10, 2025
**Purpose:** Comprehensive analysis for combining Revenue and Billing dashboards

---

## Executive Summary

**Current State:**
- **Revenue Dashboard** - Shows MTD revenue, costs, profit, and billing type breakdown
- **Billing Dashboard** - Shows KPI progress, payout tracking, and per-lead pricing

**Problem Identified:**
1. Two separate dashboards showing overlapping information
2. Data source discrepancies for MTD leads between dashboards
3. Potential confusion for users navigating between them

**Recommendation:**
✅ **Combine into single unified "Revenue & Billing Dashboard"**

---

## Current Architecture Analysis

### 1. Revenue Dashboard (`RevenueDashboard.tsx`)

**Data Source:**
- Edge Function: `revenue-analytics`
- Real-time query from: `client_metrics` table (MTD data)
- Costs from: `client_costs` table
- Pricing from: `client_registry` table

**Key Metrics Displayed:**
```
├── MTD Revenue ($)
│   └── Total billable leads (from client_metrics.positive_replies_mtd)
├── Per-Lead Revenue ($)
│   └── Number of per-lead clients
├── Retainer Revenue ($)
│   └── Number of retainer clients
└── MTD Profit ($)
    └── Overall profit margin (%)
```

**Data Flow:**
```
client_registry (pricing) + client_metrics (MTD leads) + client_costs (expenses)
  ↓
revenue-analytics Edge Function
  ↓
Calculates: revenue = leads × price_per_lead (or fixed retainer)
Calculates: profit = revenue - costs
  ↓
RevenueDashboard display
```

**MTD Leads Source:**
- `client_metrics.positive_replies_mtd` (line 67-74 in revenue-analytics/index.ts)
- Updated daily via sync process
- Represents: Positive replies marked as "interested" in Email Bison

---

### 2. Billing Dashboard (`BillingPage.tsx`)

**Data Source:**
- Edge Function: `hybrid-workspace-analytics`
- Same data as KPI Dashboard
- Real-time from Airtable + Email Bison

**Key Metrics Displayed:**
```
├── Active Clients count
├── Above KPI / Below KPI counts
├── KPI Progress by Client
│   └── Leads MTD / Monthly Target
├── Monthly Payout ($)
│   └── Price per Lead
└── Target Payout vs Actual
```

**Data Flow:**
```
hybrid-workspace-analytics Edge Function
  ↓
Fetches from Airtable workspace records
  ↓
Gets:
  - positiveRepliesMTD (leadsGenerated)
  - monthlyKPI (target)
  - payout (monthly revenue)
  ↓
BillingDashboard display
```

**MTD Leads Source:**
- `client.leadsGenerated` from Airtable (line 60 in BillingPage.tsx)
- Field name in Airtable: "Leads Generated" or similar
- Updated by: hybrid-workspace-analytics Edge Function

---

### 3. KPI Dashboard (`KPIDashboard.tsx`)

**Data Source:**
- Edge Function: `hybrid-workspace-analytics` (same as Billing)
- Real-time from Airtable

**Key Metrics:**
```
├── Total Leads Generated (MTD)
├── Monthly KPI Target
├── Current Progress (%)
├── Positive Replies (various timeframes)
└── Week-over-week comparisons
```

**MTD Leads Source:**
- `client.leadsGenerated` from hybrid-workspace-analytics
- Same source as Billing Dashboard
- Should be identical to `client_metrics.positive_replies_mtd`

---

## Data Source Comparison

### MTD Leads: Three Potential Sources

| Source | Location | Update Frequency | Used By |
|--------|----------|------------------|---------|
| **client_metrics.positive_replies_mtd** | Supabase table | Daily sync | Revenue Dashboard ✅ |
| **Airtable "Leads Generated"** | Airtable | Real-time/Manual | Billing + KPI Dashboards ✅ |
| **Email Bison interested replies** | Email Bison API | Real-time | Webhooks (sync source) |

### ⚠️ CRITICAL ISSUE: Data Discrepancy Risk

**Problem:**
- Revenue Dashboard pulls from `client_metrics` (Supabase)
- Billing Dashboard pulls from Airtable
- If these aren't syncing properly → **different numbers**

**Root Cause:**
- Two separate data pipelines:
  1. Email Bison → webhooks → client_leads → client_metrics (Supabase)
  2. Email Bison → Airtable updates → hybrid-workspace-analytics

**Solution Required:**
- ✅ Use **ONE** source of truth for MTD leads
- Recommended: `client_metrics.positive_replies_mtd` (already syncing via webhooks)

---

## Overlap Analysis

### Duplicate/Similar Information

| Metric | Revenue Dashboard | Billing Dashboard | Should Keep? |
|--------|-------------------|-------------------|--------------|
| MTD Revenue | ✅ $123,456 | ✅ "Monthly Payout" | Revenue Dashboard (more detailed) |
| MTD Leads | ✅ (in subtitle) | ✅ "Replies MTD" | Both (but from same source!) |
| Billing Type | ✅ Pie chart | ❌ Not shown | Keep in combined |
| KPI Progress | ❌ Not shown | ✅ Charts & table | Add to combined |
| Profit/Costs | ✅ Full breakdown | ❌ Not shown | Keep from Revenue |
| Price per Lead | ❌ Not calculated | ✅ Shown | Add to combined |
| Performance Status | ❌ Not shown | ✅ On-track/Warning/Danger | Add to combined |

---

## Combined Dashboard Design

### Proposed Structure: "Revenue & Billing Dashboard"

#### Top-Level Metrics (4 cards)
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  MTD Revenue    │  MTD Profit     │  Active Clients │  Avg KPI        │
│  $X             │  $Y             │  25             │  Progress       │
│  (X leads)      │  (Z% margin)    │  ↑ 5 above KPI  │  87.5%          │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

#### Tab Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│  [Revenue Overview] [Billing & KPI] [Client Breakdown] [Profitability] │
└─────────────────────────────────────────────────────────────────────┘
```

**Tab 1: Revenue Overview**
- Billing type breakdown (Per-Lead vs Retainer pie chart)
- Revenue trend over time
- Top 5 revenue generators (bar chart)
- Total MTD revenue by client (stacked bar)

**Tab 2: Billing & KPI Performance**
- KPI Progress chart (from Billing Dashboard)
- Performance distribution (Exceeding/On Track/At Risk/Critical)
- Clients below KPI (warning cards)
- Price per lead analysis

**Tab 3: Client Breakdown (Main Table)**
- Comprehensive table with ALL metrics:
  - Client Name
  - Billing Type (badge)
  - MTD Leads
  - Monthly Target
  - KPI Progress (%)
  - MTD Revenue ($)
  - MTD Costs ($)
  - MTD Profit ($)
  - Profit Margin (%)
  - Price per Lead ($)
  - Status (On-track/Warning/Danger badge)
- Sortable by any column
- Export to CSV functionality

**Tab 4: Profitability Analysis**
- Client profitability ranking (from Revenue Dashboard)
- Profit margin distribution
- Cost vs Revenue comparison
- Most/least profitable clients

---

## Data Unification Strategy

### Single Source of Truth: `client_metrics` table

**Why client_metrics:**
1. ✅ Already syncing from webhooks (real-time)
2. ✅ Stored in Supabase (faster queries)
3. ✅ Single source for MTD metrics
4. ✅ Includes all necessary fields:
   - `positive_replies_mtd` - MTD leads
   - `positive_replies_last_7_days` - Weekly
   - `positive_replies_last_30_days` - Monthly
   - `monthly_kpi` - Target
   - `reply_rate` - Performance

**Migration Path:**
```sql
-- Current Revenue Dashboard query (keep this)
SELECT
  workspace_name,
  positive_replies_mtd as mtd_leads,
  monthly_kpi as target,
  (positive_replies_mtd::float / NULLIF(monthly_kpi, 0)) * 100 as kpi_progress
FROM client_metrics
WHERE metric_date = CURRENT_DATE
  AND metric_type = 'mtd';
```

**Add to this query:**
```sql
-- Add pricing from client_registry
LEFT JOIN client_registry USING (workspace_name)

-- Calculate all metrics in one query:
SELECT
  cm.workspace_name,
  cm.positive_replies_mtd,
  cm.monthly_kpi,
  (cm.positive_replies_mtd::float / NULLIF(cm.monthly_kpi, 0)) * 100 as kpi_progress,
  cr.billing_type,
  cr.price_per_lead,
  cr.retainer_amount,
  CASE
    WHEN cr.billing_type = 'per-lead' THEN cm.positive_replies_mtd * cr.price_per_lead
    ELSE cr.retainer_amount
  END as mtd_revenue,
  cc.total_costs as mtd_costs,
  CASE
    WHEN cr.billing_type = 'per-lead' THEN (cm.positive_replies_mtd * cr.price_per_lead) - COALESCE(cc.total_costs, 0)
    ELSE cr.retainer_amount - COALESCE(cc.total_costs, 0)
  END as mtd_profit
FROM client_metrics cm
JOIN client_registry cr ON cm.workspace_name = cr.workspace_name
LEFT JOIN client_costs cc ON cm.workspace_name = cc.workspace_name
  AND cc.month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
WHERE cm.metric_date = CURRENT_DATE
  AND cm.metric_type = 'mtd'
  AND cr.is_active = true;
```

---

## Implementation Plan

### Phase 1: Data Verification ✅ (Complete First)

**Before combining dashboards, ensure data consistency:**

1. **Audit MTD Leads Across Systems**
   ```sql
   -- Compare client_metrics vs actual Email Bison counts
   SELECT
     cm.workspace_name,
     cm.positive_replies_mtd as metrics_table,
     COUNT(cl.id) FILTER (WHERE cl.interested = true AND cl.date_received >= DATE_TRUNC('month', CURRENT_DATE)) as actual_db_count
   FROM client_metrics cm
   LEFT JOIN client_leads cl ON cm.workspace_name = cl.workspace_name
   WHERE cm.metric_date = CURRENT_DATE
     AND cm.metric_type = 'mtd'
   GROUP BY cm.workspace_name, cm.positive_replies_mtd;
   ```

2. **Verify KPI Dashboard Uses Same Data**
   - Modify `hybrid-workspace-analytics` to pull from `client_metrics` instead of Airtable
   - OR: Accept Airtable as secondary display (but not for revenue calculations)

### Phase 2: Create New Combined Dashboard Component

**File:** `src/pages/RevenueAndBillingDashboard.tsx`

**Data Fetching:**
```typescript
// New Edge Function: revenue-billing-analytics
// Combines: revenue-analytics + KPI metrics

const fetchData = async () => {
  const { data, error } = await supabase.functions.invoke('revenue-billing-analytics');

  // Returns:
  {
    clients: [
      {
        workspace_name: string,
        mtd_leads: number,
        monthly_kpi: number,
        kpi_progress: number,
        billing_type: 'per-lead' | 'retainer',
        price_per_lead: number,
        mtd_revenue: number,
        mtd_costs: number,
        mtd_profit: number,
        profit_margin: number,
        status: 'on-track' | 'warning' | 'danger'
      }
    ],
    totals: {
      total_revenue: number,
      total_profit: number,
      total_leads: number,
      total_target: number,
      avg_kpi_progress: number,
      per_lead_revenue: number,
      retainer_revenue: number
    }
  }
};
```

### Phase 3: Build UI Components

**Reuse existing components:**
- KPI Progress charts from BillingPage
- Revenue breakdown from RevenueDashboard
- Table components from both

**New components needed:**
- Combined metrics table (merge both tables)
- Unified client detail view
- Performance status indicators

### Phase 4: Update Navigation

**Remove separate menu items:**
- ❌ "Revenue Dashboard"
- ❌ "Billing Dashboard"

**Add single item:**
- ✅ "Revenue & Billing"

### Phase 5: Testing & Validation

1. ✅ Verify MTD leads match across:
   - New combined dashboard
   - KPI dashboard
   - Actual client_leads table count

2. ✅ Confirm revenue calculations:
   - Per-lead: leads × price = revenue ✓
   - Retainer: fixed amount = revenue ✓

3. ✅ Test all filters and sorting

4. ✅ Validate CSV export contains all fields

---

## Migration Checklist

### Data Layer
- [ ] Create `revenue-billing-analytics` Edge Function
- [ ] Verify `client_metrics.positive_replies_mtd` is accurate
- [ ] Ensure `client_costs` table exists and has current month data
- [ ] Test query performance (<1s response time)

### UI Layer
- [ ] Create `RevenueAndBillingDashboard.tsx`
- [ ] Build combined metrics cards
- [ ] Implement tab navigation
- [ ] Add comprehensive client table
- [ ] Add KPI progress visualizations
- [ ] Add revenue breakdown charts
- [ ] Add profit analysis views

### Integration
- [ ] Update `DashboardContext.tsx` to support combined dashboard
- [ ] Update navigation/sidebar
- [ ] Add route `/revenue-billing`
- [ ] Remove old routes (or redirect to new)

### Testing
- [ ] Verify data accuracy (MTD leads match KPI dashboard)
- [ ] Test all charts and visualizations
- [ ] Test table sorting and filtering
- [ ] Test CSV export
- [ ] Test refresh functionality
- [ ] Cross-browser testing

### Documentation
- [ ] Update user documentation
- [ ] Document new data flow
- [ ] Create migration guide for users

---

## Expected Benefits

### For Users
✅ **Single source of truth** - No more wondering which dashboard to check
✅ **Complete picture** - Revenue + KPI + Billing in one place
✅ **Faster insights** - No switching between dashboards
✅ **Consistent data** - MTD leads match everywhere

### For System
✅ **Reduced complexity** - One Edge Function instead of two
✅ **Better performance** - Single query for all data
✅ **Easier maintenance** - One codebase to update
✅ **Data consistency** - Single source of truth enforced

---

## Risks & Mitigation

### Risk 1: Data Source Migration
**Risk:** Breaking existing dashboards during migration
**Mitigation:**
- Keep old dashboards temporarily (hide from menu)
- Run new dashboard in parallel for 1 week
- Validate data matches before removing old ones

### Risk 2: Performance Degradation
**Risk:** Combined query slower than separate ones
**Mitigation:**
- Add database indexes on key columns
- Implement efficient caching (30s TTL)
- Use database views for complex joins

### Risk 3: User Confusion
**Risk:** Users don't know where billing info went
**Mitigation:**
- Add redirect from old URLs
- Show banner: "Revenue & Billing dashboards have been combined"
- Update documentation/training

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Data verification | 1-2 hours | Ensure `client_metrics` is accurate |
| Edge Function creation | 2-3 hours | Combine revenue + billing logic |
| UI development | 4-6 hours | Build combined dashboard |
| Testing | 2-3 hours | Validate all metrics |
| **Total** | **9-14 hours** | Can be done in 2 days |

---

## Next Steps

1. ✅ **Approve this analysis**
2. 🔄 **Run data verification query** (ensure MTD leads are correct)
3. 🔄 **Create new Edge Function** (revenue-billing-analytics)
4. 🔄 **Build new dashboard component**
5. 🔄 **Test in parallel with existing dashboards**
6. 🔄 **Switch over and deprecate old dashboards**

---

**Status:** Ready for implementation
**Recommendation:** Proceed with combined dashboard
**Priority:** Medium-High (improves UX, reduces confusion)

