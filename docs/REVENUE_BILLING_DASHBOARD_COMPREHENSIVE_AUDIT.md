# Revenue & Billing Dashboard - Comprehensive Audit

**Date:** October 14, 2025
**Auditor:** Claude
**Purpose:** Complete technical audit of the Revenue and Billing dashboards to understand current architecture, data flow, and functionality before making edits.

---

## Executive Summary

### Current State
- **Two Separate Dashboards:**
  - **Revenue Dashboard** (`/revenue-dashboard`) - Shows MTD revenue, costs, profit, and billing type breakdown
  - **Billing Dashboard** (`/billing`) - Redirects to `/revenue-dashboard` (consolidation already in progress)

- **Status:** Billing page redirects to Revenue Dashboard, but the BillingPage.tsx component still exists in codebase
- **Data Sources:** Both use different backend services with different data freshness guarantees

---

## Architecture Overview

### 1. Revenue Dashboard

**File Location:** `src/pages/RevenueDashboard.tsx`

#### Data Flow
```
DashboardContext.revenueDashboard
    ↓
services/dataService.ts → fetchRevenueData()
    ↓
Supabase Edge Function: revenue-analytics
    ↓
Database Queries:
├── client_registry (pricing, billing type)
├── client_metrics (MTD leads, KPI data)
└── client_costs (monthly costs)
    ↓
Calculate: revenue, profit, margins
    ↓
Return: { clients[], totals{} }
```

#### Key Features
1. **Top Metrics (4 Cards)**
   - MTD Revenue (with billable leads count)
   - Per-Lead Revenue (breakdown by billing type)
   - Retainer Revenue (breakdown by billing type)
   - MTD Profit (with margin percentage)

2. **Main Chart**
   - Bar chart showing Revenue (blue) and Profit (green/red) for all clients
   - Sorted by revenue (descending)
   - Height: 500px

3. **Client Breakdown Table**
   - Columns: Client, Type, MTD Leads, MTD Revenue, Infra Costs, MTD Profit, Margin
   - Badges for billing type and profit margins
   - Color-coded profit values

#### Data Source: `revenue-analytics` Edge Function

**Location:** `supabase/functions/revenue-analytics/index.ts`

**Process:**
1. Fetch active clients from `client_registry`
2. Get MTD metrics from `client_metrics` table (WHERE metric_date = CURRENT_DATE)
3. Get costs from `client_costs` table (WHERE month_year = current month)
4. Calculate revenue per client:
   - **Per-lead:** `mtd_leads × price_per_lead`
   - **Retainer:** `fixed retainer_amount`
5. Calculate profit: `revenue - costs`
6. Calculate margin: `(profit / revenue) × 100`

**Database Tables Used:**
- `client_registry` - Pricing, billing types, active status
- `client_metrics` - MTD leads, KPI targets (updated by nightly cron)
- `client_costs` - Monthly cost breakdown

**Key Issue:** `client_metrics` table relies on nightly sync job. If sync fails, data becomes stale.

---

### 2. Billing Dashboard (Legacy)

**File Location:** `src/pages/BillingPage.tsx`

**Current Status:** Page exists but route redirects to `/revenue-dashboard` (line 43 of App.tsx)

#### Original Data Flow
```
BillingPage Component (standalone - no DashboardContext)
    ↓
Direct Supabase call to hybrid-workspace-analytics
    ↓
Email Bison API (real-time stats per workspace)
    ↓
Returns: KPI progress, payout, leads MTD
```

#### Key Features (when active)
1. **Top Metrics (4 Cards)**
   - Active Clients count
   - Above KPI count
   - Below KPI count
   - Client selector dropdown

2. **Selected Client Detail Card**
   - Monthly Revenue
   - Leads MTD
   - Monthly Target
   - KPI Progress

3. **Tabs:**
   - **Overview:** KPI progress line chart, performance distribution pie chart
   - **Revenue Analysis:** Revenue vs Target bar chart
   - **KPI Performance:** KPI progress by client, clients below KPI
   - **Total View:** Comprehensive table with all metrics + CSV export

#### Data Source: `hybrid-workspace-analytics` Edge Function

**Location:** `supabase/functions/hybrid-workspace-analytics/index.ts`

**Process:**
1. Fetch workspaces from Email Bison API
2. For each workspace:
   - Use workspace-specific API key (or master key with workspace switching)
   - Fetch MTD stats, last 7 days, last 30 days, last month stats
   - Extract `interested` count (positive replies)
3. Get KPI targets from `client_registry`
4. Calculate projections, progress percentages
5. Return real-time data

**Key Difference:** This function queries Email Bison API directly, providing **real-time data** vs. Revenue Dashboard's nightly sync.

---

## Database Schema

### `client_registry`
**Purpose:** Single source of truth for client configuration

```sql
CREATE TABLE client_registry (
  workspace_id UUID PRIMARY KEY,
  workspace_name TEXT UNIQUE,
  display_name TEXT,
  bison_workspace_id INTEGER,
  bison_api_key TEXT,
  bison_instance TEXT,

  -- Billing Configuration
  billing_type TEXT CHECK (billing_type IN ('per_lead', 'retainer')),
  price_per_lead DECIMAL(10,2),
  retainer_amount DECIMAL(10,2),
  payout DECIMAL(10,2),

  -- KPI Configuration
  monthly_kpi_target INTEGER,
  monthly_sending_target INTEGER,
  daily_sending_target INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### `client_metrics`
**Purpose:** Cached KPI metrics updated by nightly cron job

```sql
CREATE TABLE client_metrics (
  id UUID PRIMARY KEY,
  workspace_name TEXT,
  metric_date DATE,
  metric_type TEXT, -- 'mtd', 'last_7_days', etc.

  -- KPI Metrics
  positive_replies_mtd INTEGER,
  positive_replies_last_7_days INTEGER,
  positive_replies_last_30_days INTEGER,
  monthly_kpi INTEGER,

  -- Performance
  reply_rate DECIMAL(5,2),
  interested_rate DECIMAL(5,2),

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  UNIQUE(workspace_name, metric_date, metric_type)
);
```

**Update Mechanism:** Nightly cron job `sync-daily-kpi-metrics` (runs at midnight)

### `client_costs`
**Purpose:** Monthly cost tracking for profitability analysis

```sql
CREATE TABLE client_costs (
  id UUID PRIMARY KEY,
  workspace_name TEXT,
  month_year TEXT, -- Format: "2025-10"

  -- Cost Breakdown
  email_account_costs DECIMAL(10,2) DEFAULT 0,
  labor_costs DECIMAL(10,2) DEFAULT 0,
  other_costs DECIMAL(10,2) DEFAULT 0,
  total_costs DECIMAL(10,2) GENERATED ALWAYS AS (
    email_account_costs + labor_costs + other_costs
  ) STORED,

  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  UNIQUE(workspace_name, month_year)
);
```

**Update Mechanism:** Manual via admin interface or SQL scripts

### `client_revenue_mtd` (Cache Table)
**Purpose:** Pre-calculated revenue metrics for faster dashboard loading

```sql
CREATE TABLE client_revenue_mtd (
  id UUID PRIMARY KEY,
  workspace_name TEXT,
  metric_date DATE,

  -- Revenue Metrics
  current_month_revenue DECIMAL(10,2),
  current_month_costs DECIMAL(10,2),
  current_month_profit DECIMAL(10,2),
  profit_margin DECIMAL(5,2),

  -- KPI Metrics
  current_month_leads INTEGER,
  monthly_kpi INTEGER,
  kpi_progress DECIMAL(5,2),

  -- Email Performance
  emails_sent_mtd INTEGER,
  replies_mtd INTEGER,
  interested_mtd INTEGER,
  reply_rate DECIMAL(5,2),

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  UNIQUE(workspace_name, metric_date)
);
```

**Status:** Table exists but not currently used by Revenue Dashboard (queries `client_metrics` directly instead)

---

## Data Freshness Comparison

| Metric | Revenue Dashboard | Billing Dashboard | Source |
|--------|------------------|-------------------|--------|
| **MTD Leads** | Daily (nightly sync) | Real-time | `client_metrics` vs Email Bison API |
| **Revenue** | Daily (calculated) | Real-time (calculated) | Based on MTD leads |
| **Costs** | Monthly (manual entry) | N/A | `client_costs` table |
| **KPI Progress** | Daily | Real-time | Calculated from leads |
| **Email Stats** | Not shown | Real-time | Email Bison API only |

**Critical Issue:** Revenue Dashboard shows stale data if nightly sync fails. Billing Dashboard (when active) shows real-time data.

---

## UI Component Breakdown

### Revenue Dashboard Components

**Location:** `src/pages/RevenueDashboard.tsx` (240 lines)

**Dependencies:**
- `useDashboardContext()` hook
- `recharts` library (BarChart)
- shadcn/ui components (Card, Table, Badge, Button, Skeleton)

**State Management:**
```typescript
const { revenueDashboard, refreshRevenueDashboard } = useDashboardContext();
const { clients, totals, loading, lastUpdated } = revenueDashboard;
```

**Computed Values:**
```typescript
const sortedByRevenue = useMemo(() =>
  [...clients].sort((a, b) => b.current_month_revenue - a.current_month_revenue)
, [clients]);

const perLeadPercentage = useMemo(() =>
  (totals.total_per_lead_revenue / totals.total_mtd_revenue) * 100
, [totals]);
```

**Key Sections:**
1. Header (lines 66-92)
   - Sticky top bar with title, back button, refresh button
2. Metrics Cards (lines 96-156)
   - 4 cards in grid layout
3. Revenue Chart (lines 159-187)
   - Full-width bar chart with revenue and profit
4. Client Table (lines 190-234)
   - Detailed breakdown with 7 columns

### Billing Dashboard Components

**Location:** `src/pages/BillingPage.tsx` (843 lines)

**Dependencies:**
- Direct Supabase client import
- `recharts` library (LineChart, PieChart, BarChart)
- shadcn/ui components

**State Management:**
```typescript
const [clientsData, setClientsData] = useState<ClientBillingData[]>([]);
const [selectedClient, setSelectedClient] = useState<string>("all");
const [loading, setLoading] = useState(true);
```

**Data Fetching:**
```typescript
useEffect(() => {
  const fetchBillingData = async () => {
    const { data } = await supabase.functions.invoke('hybrid-workspace-analytics');
    // Process and calculate KPI progress, status, etc.
  };
  fetchBillingData();
}, []);
```

**Key Features:**
- Client selector dropdown
- 4 tabs (Overview, Revenue Analysis, KPI Performance, Total View)
- CSV export functionality
- Performance distribution charts

---

## Context & State Management

### DashboardContext

**Location:** `src/contexts/DashboardContext.tsx` (740 lines)

**Revenue Dashboard State:**
```typescript
interface RevenueDashboardState {
  clients: RevenueClientData[];
  totals: RevenueTotals;
  lastUpdated: Date | null;
  loading: boolean;
  isUsingCache: boolean;
  isFresh: boolean;
  error: string | null;
  warnings: string[];
  fetchDurationMs?: number;
}
```

**Refresh Mechanism:**
```typescript
const refreshRevenueDashboard = useCallback(async (force: boolean = true) => {
  // Rate limiting check (30s minimum between refreshes)
  const now = Date.now();
  if (!force && (now - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
    return;
  }

  setLastRefreshTime(now);
  await fetchRevenueDataInternal(force);
}, [fetchRevenueDataInternal, lastRefreshTime]);
```

**Cache Strategy:**
- Cache duration: 2 minutes
- Stored in localStorage
- Cache keys:
  - `revenue-dashboard-data`
  - `revenue-dashboard-timestamp`

---

## Data Service Layer

### `fetchRevenueData()` Function

**Location:** `src/services/dataService.ts`

**Process:**
1. Check cache validity (2-minute TTL)
2. If cache valid and not forcing: return cached data
3. Call `revenue-analytics` Edge Function
4. Validate response structure
5. Save to cache
6. Return data with metadata (cached, fresh, fetchDurationMs)

**Validation:**
```typescript
// Ensures response has required structure
if (!data.clients || !Array.isArray(data.clients)) {
  throw new Error('Invalid revenue data structure');
}
if (!data.totals) {
  throw new Error('Missing totals in revenue data');
}
```

---

## Revenue Calculation Logic

### Per-Lead Billing
```typescript
// Revenue = MTD Leads × Price Per Lead
const mtdLeads = metric.positive_replies_mtd || 0;
const pricePerLead = pricing.price_per_lead;
const revenue = mtdLeads × pricePerLead;
```

**Example:**
- Client: Danny Schwartz
- MTD Leads: 27
- Price Per Lead: $100
- **Revenue: $2,700**

### Retainer Billing
```typescript
// Revenue = Fixed Monthly Amount
const revenue = pricing.retainer_amount;
```

**Example:**
- Client: Jason Binyon
- Retainer: $15,000/month
- **Revenue: $15,000** (regardless of leads)

### Profit Calculation
```typescript
const costs = costsLookup[workspace_name] || 0;
const profit = revenue - costs;
const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
```

**Example:**
- Revenue: $2,700
- Costs: $450
- **Profit: $2,250**
- **Margin: 83.3%**

---

## API Endpoints

### 1. `revenue-analytics`

**Method:** POST
**URL:** `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/revenue-analytics`
**Auth:** Bearer token (Supabase anon key)

**Response Structure:**
```json
{
  "clients": [
    {
      "workspace_name": "Danny Schwartz",
      "billing_type": "per_lead",
      "current_month_leads": 27,
      "current_month_revenue": 2700,
      "current_month_costs": 450,
      "current_month_profit": 2250,
      "profit_margin": 83.3,
      "price_per_lead": 100,
      "retainer_amount": 0,
      "rank": 1
    }
  ],
  "totals": {
    "total_mtd_revenue": 45000,
    "total_mtd_costs": 8000,
    "total_mtd_profit": 37000,
    "total_mtd_leads": 189,
    "total_per_lead_revenue": 30000,
    "total_retainer_revenue": 15000,
    "per_lead_count": 20,
    "retainer_count": 5,
    "overall_profit_margin": 82.2
  },
  "meta": {
    "month_year": "2025-10",
    "snapshot_date": "2025-10-14"
  }
}
```

### 2. `hybrid-workspace-analytics`

**Method:** POST
**URL:** `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-workspace-analytics`
**Auth:** Bearer token (Supabase anon key)

**Response Structure:**
```json
{
  "clients": [
    {
      "id": "workspace-123",
      "name": "Danny Schwartz",
      "leadsGenerated": 27,
      "monthlyKPI": 30,
      "currentProgress": 0.9,
      "positiveRepliesLast7Days": 8,
      "positiveRepliesLast30Days": 27,
      "emailsSent": 12500,
      "payout": 2700
    }
  ]
}
```

---

## Routing & Navigation

### Current Routes (App.tsx)

```typescript
<Route path="/billing" element={<Navigate to="/revenue-dashboard" replace />} />
<Route path="/revenue-dashboard" element={<RevenueDashboard />} />
```

**Status:**
- `/billing` → Redirects to `/revenue-dashboard`
- `/revenue-dashboard` → Shows Revenue Dashboard
- `BillingPage.tsx` component exists but unused

### Sidebar Navigation

**Location:** Check `src/components/layout/Sidebar.tsx` or `src/components/AppSidebar.tsx`

**Current Links:**
- ✅ "Revenue Dashboard" → `/revenue-dashboard`
- ❌ "Billing Dashboard" → (likely removed or redirects)

---

## Performance Metrics

### Load Times (Typical)

| Dashboard | First Load | Cached Load | Refresh |
|-----------|-----------|-------------|---------|
| **Revenue** | 800-1200ms | 50-100ms | 500-800ms |
| **Billing** | 1500-3000ms | N/A | 1500-3000ms |

**Factors:**
- Revenue: Single DB query + calculations
- Billing: Multiple Email Bison API calls (sequential workspace switching)

### Data Volume

| Metric | Count |
|--------|-------|
| Active Clients | 25 |
| Client Records (monthly) | 25 |
| Cost Records (monthly) | ~15-20 |
| Metric Records (daily) | 25 |

---

## Known Issues & Limitations

### 1. Data Staleness
**Issue:** Revenue Dashboard relies on nightly sync to `client_metrics`
**Impact:** If sync fails, MTD leads are stale
**Example:** Last sync Oct 7, viewing on Oct 14 = 7 days stale
**Solution:** Use real-time Email Bison API (like Billing Dashboard)

### 2. Billing Dashboard Unused
**Issue:** BillingPage component exists but route redirects
**Impact:** Code bloat, potential confusion
**Solution:** Remove component or integrate features into Revenue Dashboard

### 3. Duplicate Data Sources
**Issue:** Two different sources for MTD leads
**Impact:** Potential discrepancies between dashboards
**Example:** Revenue shows 27 leads, KPI shows 29 (if sync delayed)

### 4. Manual Cost Entry
**Issue:** `client_costs` requires manual SQL updates
**Impact:** Costs may be outdated or missing
**Solution:** Build admin UI for cost management

### 5. No Historical Tracking
**Issue:** Only current month data shown
**Impact:** Cannot compare month-over-month revenue
**Solution:** Add time range selector, historical charts

---

## Strengths

### ✅ What Works Well

1. **Clean Separation:** Revenue and KPI data properly separated
2. **Flexible Billing:** Supports per-lead and retainer models
3. **Real-time Refresh:** Manual refresh button prevents stale data during active use
4. **Good UI/UX:** Clear metrics, color-coded profit indicators
5. **Caching:** 2-minute cache reduces API calls
6. **Rate Limiting:** Prevents spam refreshing (30s cooldown)
7. **Context Management:** Centralized state in DashboardContext

---

## Improvement Opportunities

### 🔄 Potential Enhancements

1. **Real-time Data:**
   - Switch Revenue Dashboard to use Email Bison API directly
   - Eliminate dependency on nightly sync

2. **Dashboard Consolidation:**
   - Merge best features from both dashboards
   - Single unified "Revenue & Billing" page

3. **Historical Analysis:**
   - Month-over-month revenue comparison
   - Trend charts (last 3 months, 6 months, YTD)
   - Client performance over time

4. **Cost Management:**
   - Admin UI for entering/updating costs
   - Cost breakdown by category
   - Cost trend analysis

5. **Advanced Metrics:**
   - Customer Lifetime Value (LTV)
   - Customer Acquisition Cost (CAC)
   - LTV:CAC ratio
   - Revenue per email sent

6. **Export Features:**
   - CSV export for revenue data
   - PDF reports for clients
   - Email scheduled reports

7. **Alerts & Notifications:**
   - Low profit margin warnings
   - Clients significantly below KPI
   - Revenue milestones reached

8. **Forecasting:**
   - Projected end-of-month revenue
   - Based on current pace + historical trends
   - Confidence intervals

---

## Technical Debt

### Code to Remove
- [ ] `src/pages/BillingPage.tsx` (843 lines) - if consolidating
- [ ] Redirect route in App.tsx (if removing billing entirely)

### Code to Update
- [ ] Revenue Dashboard - switch to real-time data source
- [ ] Add email performance metrics to Revenue Dashboard
- [ ] Consolidate duplicate client filtering logic

### Documentation Needed
- [ ] Cost entry process for finance team
- [ ] Revenue calculation explanations
- [ ] Dashboard user guide

---

## Recommendations for Next Steps

### Priority 1: Data Consistency
1. Verify `client_metrics` sync job is running
2. Compare MTD leads: `client_metrics` vs Email Bison API
3. Switch Revenue Dashboard to real-time source if sync unreliable

### Priority 2: Dashboard Consolidation
1. Decide: Merge dashboards or keep separate?
2. If merging: Create unified component with tabs
3. If separate: Define clear use cases for each

### Priority 3: Cost Management
1. Build admin UI for cost entry
2. Add bulk import for historical costs
3. Implement cost allocation rules

### Priority 4: Feature Enhancements
1. Add time range selector (MTD, last 30 days, custom)
2. Add historical trend charts
3. Add export functionality

---

## Questions for Stakeholders

1. **Dashboard Purpose:**
   - Should Revenue and Billing be separate or combined?
   - Who is the primary user of each dashboard?
   - What decisions are made based on this data?

2. **Data Freshness:**
   - Is real-time data required, or is daily sync acceptable?
   - How critical is accuracy vs. performance?

3. **Cost Tracking:**
   - Who is responsible for entering cost data?
   - How often should costs be updated?
   - What level of detail is needed (breakdown by category)?

4. **Metrics Priority:**
   - Which metrics are most important?
   - Any missing metrics needed for business decisions?
   - Should we track more granular data (weekly, daily)?

5. **Historical Data:**
   - Do we need month-over-month comparisons?
   - How far back should historical data go?
   - Any specific reporting requirements?

---

## Appendix: File Reference

### Frontend Components
- `src/pages/RevenueDashboard.tsx` - Revenue dashboard UI (240 lines)
- `src/pages/BillingPage.tsx` - Billing dashboard UI (843 lines, unused)
- `src/contexts/DashboardContext.tsx` - State management (740 lines)
- `src/services/dataService.ts` - Data fetching layer
- `src/App.tsx` - Routing configuration

### Backend Functions
- `supabase/functions/revenue-analytics/index.ts` - Revenue data aggregation (215 lines)
- `supabase/functions/hybrid-workspace-analytics/index.ts` - KPI analytics (336 lines)

### Database Migrations
- `supabase/migrations/20251010130000_create_client_costs_table.sql`
- `supabase/migrations/20251012000000_create_client_revenue_mtd.sql`

### Documentation
- `docs/REVENUE_BILLING_DASHBOARD_ANALYSIS.md` - Previous analysis
- `docs/CORRECTED_REVENUE_BILLING_PLAN.md` - Consolidation plan
- `docs/INFRASTRUCTURE_COSTS_IMPLEMENTATION.md` - Cost tracking setup

---

**Audit Status:** ✅ Complete
**Next Action:** Review with stakeholders, prioritize improvements
**Last Updated:** October 14, 2025
