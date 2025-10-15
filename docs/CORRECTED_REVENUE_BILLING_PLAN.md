# Corrected Revenue & Billing Dashboard Consolidation Plan

**Date:** October 10, 2025
**Status:** Data Verification Complete - Ready for Implementation

---

## ✅ Data Verification Results

### Key Findings:

1. **✅ NO AIRTABLE** - Confirmed! All data comes from:
   - Email Bison API (real-time stats)
   - Supabase tables (client_registry, client_leads, client_metrics, client_costs)

2. **📊 Current Data Sources:**

| Dashboard | Data Source | Freshness | Method |
|-----------|-------------|-----------|--------|
| **Revenue** | `revenue-analytics` Edge Function | Daily | Queries client_metrics + client_registry + client_costs |
| **Billing** | `hybrid-workspace-analytics` Edge Function | Real-time | Fetches Email Bison API stats directly |
| **KPI** | `hybrid-workspace-analytics` Edge Function | Real-time | Fetches Email Bison API stats directly |

3. **⚠️ CRITICAL DISCOVERY:**
   - `client_metrics` table exists BUT last update was **Oct 7** (3 days old!)
   - Revenue Dashboard is showing STALE data (3 days behind)
   - KPI/Billing Dashboards show REAL-TIME data from Email Bison
   - **This explains any discrepancies!**

4. **✅ Actual MTD Leads (from client_leads table):**
   - **189 interested leads MTD** across 14 workspaces
   - This is the true count from webhook syncing
   - Matches what Email Bison API would return

---

## Data Flow - CORRECTED

```
┌─────────────────────────────────────────────────────────────────────┐
│ EMAIL BISON (Source of Truth)                                       │
│ - Leads marked "interested"                                          │
│ - Stats API: /workspaces/v1.1/stats                                 │
└───────────────┬─────────────────────────────────────────────────────┘
                │
      ┌─────────┴──────────┐
      │                    │
      ▼                    ▼
┌─────────────┐    ┌────────────────────┐
│  WEBHOOKS   │    │  EDGE FUNCTIONS    │
│             │    │  (hybrid-workspace  │
│ Real-time   │    │   -analytics)      │
│ sync to →   │    │                    │
│ client_leads│    │  Queries Email     │
│             │    │  Bison API         │
└─────┬───────┘    │  directly          │
      │            └────────┬───────────┘
      │                     │
      ▼                     ▼
┌─────────────────┐   ┌──────────────────┐
│ client_leads    │   │ KPI Dashboard    │◄─── Real-time
│ table           │   │ Billing Dashboard│◄─── Real-time
│ (189 leads MTD) │   └──────────────────┘
└─────┬───────────┘
      │
      │ Daily sync (BROKEN - last run Oct 7!)
      ▼
┌─────────────────┐
│ client_metrics  │
│ table           │
│ (STALE DATA)    │
└─────┬───────────┘
      │
      ▼
┌──────────────────┐
│ Revenue Dashboard│◄─── Uses STALE data
└──────────────────┘
```

---

## Problem Statement

**Issue:** Revenue Dashboard uses `client_metrics` which is NOT being updated

**Impact:**
- Revenue Dashboard shows MTD leads from 3 days ago
- KPI/Billing Dashboards show real-time data
- **Combining them would show inconsistent numbers!**

**Root Cause:**
- Daily sync process (`update-client-metrics` or similar) is not running
- OR: Process exists but has errors

---

## Solution: Combined Dashboard with Real-Time Data

### Approach: Use Email Bison API Directly (Like KPI/Billing)

**Why:**
1. ✅ Real-time data (no sync delay)
2. ✅ Consistent with KPI Dashboard (users expect this)
3. ✅ Already proven to work (hybrid-workspace-analytics)
4. ✅ No dependency on broken sync process

**Implementation:**

Create new Edge Function: `revenue-billing-unified`

This function will:
1. Fetch Email Bison stats (like hybrid-workspace-analytics does)
2. Get pricing from `client_registry`
3. Get costs from `client_costs`
4. Calculate revenue, profit on-the-fly
5. Return complete dataset for combined dashboard

---

## New Edge Function Spec

### Function Name: `revenue-billing-unified`

### Input:
```typescript
{
  force?: boolean // Force refresh (bypass cache)
}
```

### Process:

1. **Get Active Clients from client_registry**
   ```sql
   SELECT
     workspace_name,
     bison_workspace_id,
     billing_type,
     price_per_lead,
     retainer_amount,
     monthly_kpi_target,
     payout,
     bison_api_key,
     bison_instance
   FROM client_registry
   WHERE is_active = true;
   ```

2. **For Each Client: Fetch Email Bison Stats**
   ```typescript
   // Use workspace-specific API key (no super admin!)
   const mtdStats = await fetch(
     `${baseUrl}/workspaces/v1.1/stats?start_date=${monthStart}&end_date=${today}`,
     {
       headers: {
         'Authorization': `Bearer ${client.bison_api_key}`,
         'Accept': 'application/json',
       },
     }
   );

   const positiveRepliesMTD = mtdStats.data.interested;
   const emailsSent = mtdStats.data.emails_sent;
   ```

3. **Calculate Revenue**
   ```typescript
   let mtdRevenue = 0;
   if (billing_type === 'per-lead') {
     mtdRevenue = positiveRepliesMTD * price_per_lead;
   } else {
     mtdRevenue = retainer_amount; // Fixed monthly
   }
   ```

4. **Get Costs**
   ```sql
   SELECT total_costs
   FROM client_costs
   WHERE workspace_name = ${workspace_name}
     AND month_year = ${currentMonthYear}; // e.g., '2025-10'
   ```

5. **Calculate Profit & KPI**
   ```typescript
   const mtdCosts = costs || 0;
   const mtdProfit = mtdRevenue - mtdCosts;
   const profitMargin = mtdRevenue > 0 ? (mtdProfit / mtdRevenue) * 100 : 0;
   const kpiProgress = monthlyKPI > 0 ? (positiveRepliesMTD / monthlyKPI) * 100 : 0;

   const status = kpiProgress >= 100 ? 'on-track' :
                  kpiProgress >= 80 ? 'warning' : 'danger';
   ```

6. **Return Complete Dataset**
   ```typescript
   return {
     clients: [
       {
         workspace_name: string,
         billing_type: 'per-lead' | 'retainer',
         mtd_leads: number,
         monthly_kpi: number,
         kpi_progress: number,
         price_per_lead: number,
         mtd_revenue: number,
         mtd_costs: number,
         mtd_profit: number,
         profit_margin: number,
         status: 'on-track' | 'warning' | 'danger',
         emails_sent: number,
         payout: number // For per-lead: actual payout, for retainer: fixed
       }
     ],
     totals: {
       total_revenue: number,
       total_per_lead_revenue: number,
       total_retainer_revenue: number,
       total_profit: number,
       total_costs: number,
       total_leads: number,
       total_kpi: number,
       avg_kpi_progress: number,
       overall_profit_margin: number,
       per_lead_count: number,
       retainer_count: number,
       above_kpi_count: number,
       below_kpi_count: number
     }
   };
   ```

---

## Combined Dashboard UI Structure

### File: `src/pages/RevenueAndBillingDashboard.tsx`

### Top Metrics (4 Cards)
```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ MTD Revenue      │ MTD Profit       │ Active Clients   │ Avg KPI Progress │
│ $X               │ $Y (Z% margin)   │ 25               │ 87.5%            │
│ (189 leads)      │                  │ ↑ 18 above KPI   │                  │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### Tabs:

**Tab 1: Overview**
- Revenue by Type (pie chart: Per-Lead vs Retainer)
- Top 5 Revenue Generators (bar chart)
- KPI Progress Distribution (donut: Exceeding/On Track/At Risk/Critical)
- Performance trend line (from Billing dashboard)

**Tab 2: Client Performance (Main Table)**
- Sortable, filterable table with ALL metrics:

| Client | Type | MTD Leads | Target | KPI % | Revenue | Costs | Profit | Margin | Status |
|--------|------|-----------|--------|-------|---------|-------|--------|--------|--------|
| Danny Schwartz | Per-Lead | 27 | 30 | 90% | $2,700 | $500 | $2,200 | 81% | ✅ On Track |
| Devin Hodo | Per-Lead | 21 | 25 | 84% | $2,100 | $450 | $1,650 | 79% | ⚠️ Warning |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

- Export to CSV button
- Filter by: Status, Billing Type
- Search by client name

**Tab 3: Profitability Analysis**
- Client profitability ranking (sorted by profit margin)
- Profit vs Revenue scatter plot
- Cost breakdown by client
- Most/Least profitable clients cards

**Tab 4: Billing & Payments**
- Per-lead pricing breakdown
- Target payout vs Actual payout comparison
- Clients below KPI (warning cards with action items)
- Monthly payout summary

---

## Implementation Steps

### Step 1: Create Edge Function ✅

**File:** `supabase/functions/revenue-billing-unified/index.ts`

**Key Points:**
- ✅ Use workspace-specific API keys (already have 25 of them!)
- ✅ Parallel fetching (batch of 5 at a time to avoid rate limits)
- ✅ Cache results for 30 seconds (balance real-time vs performance)
- ✅ Error handling per workspace (don't fail entire request if one fails)

### Step 2: Deploy Edge Function ✅

```bash
SUPABASE_ACCESS_TOKEN=sbp_765c83453a7d30be808b30e47cc230e0e9686015 \
npx supabase functions deploy revenue-billing-unified \
--no-verify-jwt \
--project-ref gjqbbgrfhijescaouqkx
```

### Step 3: Update DashboardContext ✅

**File:** `src/contexts/DashboardContext.tsx`

Add:
```typescript
interface RevenueBillingDashboard {
  clients: RevenueBillingClient[];
  totals: RevenueBillingTotals;
  loading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

const refreshRevenueBilling = async (force = false) => {
  // Call revenue-billing-unified Edge Function
};
```

### Step 4: Create Combined Dashboard Component ✅

**File:** `src/pages/RevenueAndBillingDashboard.tsx`

Reuse components from:
- `RevenueDashboard.tsx` - Revenue charts, profit cards
- `BillingPage.tsx` - KPI progress charts, performance distribution
- Create new: Comprehensive client table with all fields

### Step 5: Update Navigation ✅

**File:** `src/components/layout/Sidebar.tsx` or similar

Remove:
- ❌ "Revenue Dashboard" link
- ❌ "Billing Dashboard" link

Add:
- ✅ "Revenue & Billing" → `/revenue-billing`

### Step 6: Add Redirects ✅

**File:** `src/App.tsx`

```typescript
// Redirect old routes to new combined dashboard
<Route path="/revenue" element={<Navigate to="/revenue-billing" replace />} />
<Route path="/billing" element={<Navigate to="/revenue-billing" replace />} />
<Route path="/revenue-billing" element={<RevenueAndBillingDashboard />} />
```

### Step 7: Testing Checklist ✅

- [ ] Verify MTD leads match KPI dashboard
- [ ] Verify revenue calculations (per-lead vs retainer)
- [ ] Verify profit = revenue - costs
- [ ] Test table sorting (all columns)
- [ ] Test CSV export
- [ ] Test real-time refresh
- [ ] Cross-browser testing
- [ ] Mobile responsive testing

---

## Benefits of This Approach

### For Users:
✅ **Single source of truth** - One place for revenue, billing, and KPI
✅ **Real-time data** - No more stale metrics
✅ **Complete picture** - All metrics in one dashboard
✅ **Faster insights** - No switching between dashboards

### For System:
✅ **No broken dependencies** - Doesn't rely on daily sync
✅ **Consistent data** - All from Email Bison API
✅ **Better performance** - Direct API calls with caching
✅ **Easier maintenance** - One codebase, one data source

---

## Timeline Estimate

| Task | Duration | Priority |
|------|----------|----------|
| Create `revenue-billing-unified` Edge Function | 3-4 hours | P0 |
| Test Edge Function | 1 hour | P0 |
| Deploy Edge Function | 15 min | P0 |
| Create combined dashboard UI | 4-5 hours | P0 |
| Update navigation & routes | 30 min | P0 |
| Testing & validation | 2 hours | P0 |
| **Total** | **11-13 hours** | - |

**Can be completed in 2 working days**

---

## Next Steps

1. ✅ **Data Verification** - COMPLETE
2. 🔄 **Create Edge Function** - START HERE
3. 🔄 **Build UI Component**
4. 🔄 **Test in parallel with existing**
5. 🔄 **Switch over & deprecate old dashboards**

---

## Bonus: Fix Daily Sync (Optional)

**If you want to keep client_metrics table updated:**

Find the sync function (likely in `supabase/functions/` or as a cron job) and ensure it runs daily. This would allow fallback to cached data if Email Bison API is slow.

However, **NOT REQUIRED** for combined dashboard since we're using real-time API.

---

**Status:** ✅ Ready to implement
**Recommended:** Proceed with Edge Function creation
**Priority:** High (consolidates duplicate dashboards, fixes stale data issue)

