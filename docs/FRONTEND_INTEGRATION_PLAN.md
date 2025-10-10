# Frontend Integration Plan - Real-Time Data Migration
## Connecting Dashboards to New Real-Time Infrastructure

**Date:** October 9, 2025
**Purpose:** Migrate frontend from slow Edge Functions to fast real-time database queries
**Risk Level:** 🟡 MEDIUM (production system, must ensure zero downtime)

---

## Executive Summary

**Current State:**
- Backend infrastructure ✅ COMPLETE (webhooks + polling running)
- Frontend dashboards ❌ NOT CONNECTED (still using old slow methods)
- Data being collected but NOT displayed to users

**Target State:**
- Frontend queries Supabase tables directly (instant <100ms load times)
- Real-time auto-updates via Supabase Realtime subscriptions
- No more manual refresh buttons needed
- Client portal shows correct lead data from webhooks

**Performance Impact:**
| Dashboard | Current Load Time | Target Load Time | Improvement |
|-----------|-------------------|------------------|-------------|
| Email Infrastructure | 30-60s | <1s | **60x faster** |
| KPI Dashboard | 5-10s | <500ms | **20x faster** |
| Volume Dashboard | 3-5s | <300ms | **15x faster** |
| Client Portal Leads | 2-3s | <200ms | **15x faster** |

---

## Current System Architecture (COMPLETE AUDIT)

### Data Flow - AS IS (Old System)

```
Frontend (React)
    ↓
dataService.ts (in-memory cache, 2-min TTL)
    ↓
Edge Functions (fetch from Email Bison API every request)
    ├─ hybrid-workspace-analytics    → KPI Dashboard
    ├─ volume-dashboard-data         → Volume Dashboard
    ├─ revenue-analytics             → Revenue Dashboard
    └─ hybrid-email-accounts-v2      → Email Infrastructure (30-60s for 4000+ accounts)
    ↓
Email Bison API (external, rate-limited, slow)
```

**Problems:**
1. ❌ Every dashboard refresh hits Email Bison API (slow, rate-limited)
2. ❌ Email Infrastructure takes 30-60 seconds (fetches 4000+ accounts on-demand)
3. ❌ 2-minute cache means stale data
4. ❌ No real-time updates - manual refresh required
5. ❌ High Email Bison API usage costs

---

### Data Sources Currently in Use

**1. KPI Dashboard** ([src/pages/KPIDashboard.tsx](../src/pages/KPIDashboard.tsx))
- **Current:** `fetchKPIData()` → Edge Function `hybrid-workspace-analytics`
- **Calls:** Email Bison `/workspaces/v1.1/stats` for each workspace
- **Data:** MTD stats, projections, rolling windows
- **Cache:** 2 minutes in-memory
- **Load Time:** 5-10 seconds
- **Users Affected:** Internal team

**2. Volume Dashboard** ([src/pages/VolumeDashboard.tsx](../src/pages/VolumeDashboard.tsx))
- **Current:** `fetchVolumeData()` → Edge Function `volume-dashboard-data`
- **Calls:** Email Bison `/workspaces/v1.1/stats` for MTD sending
- **Data:** Emails sent MTD, today, last 7/14/30 days, projections
- **Cache:** 30 seconds in-memory
- **Load Time:** 3-5 seconds
- **Users Affected:** Internal team

**3. Revenue Dashboard** ([src/pages/RevenueDashboard.tsx](../src/pages/RevenueDashboard.tsx))
- **Current:** `fetchRevenueData()` → Edge Function `revenue-analytics`
- **Calls:** Supabase `client_registry` + calculations
- **Data:** Revenue calculations, profit margins
- **Cache:** 5 minutes in-memory
- **Load Time:** 1-2 seconds
- **Users Affected:** Internal team
- **Note:** ✅ Already uses Supabase - minimal changes needed

**4. Email Infrastructure** ([src/pages/EmailAccountsPage.tsx](../src/pages/EmailAccountsPage.tsx))
- **Current:** `fetchInfrastructureData()` → Edge Function `hybrid-email-accounts-v2`
- **Calls:** Email Bison `/sender-emails` for ALL workspaces (paginated)
- **Data:** 4000+ email accounts, per-account metrics, provider tags
- **Cache:** 10 minutes in-memory
- **Load Time:** 30-60 seconds (!!!!)
- **Users Affected:** Internal team
- **Note:** 🔴 MOST CRITICAL - biggest performance bottleneck

**5. Client Portal** ([src/pages/ClientPortalPage.tsx](../src/pages/ClientPortalPage.tsx))
- **Current:** Direct Supabase query to `client_leads` table
- **Data:** Interested leads only, pipeline stages
- **Cache:** None (real-time)
- **Load Time:** 1-2 seconds
- **Users Affected:** 24 external clients
- **Note:** ✅ Already using Supabase correctly - needs lead sync verification

**6. HomePage** ([src/pages/Index.tsx](../src/pages/Index.tsx))
- **Current:** Uses `DashboardContext` → calls all fetchXXXData() functions
- **Data:** Aggregated summary cards
- **Cache:** Inherited from dataService
- **Load Time:** Varies by which data loads first
- **Users Affected:** Internal team

---

## New System Architecture (TARGET)

### Data Flow - TO BE (New System)

```
Frontend (React)
    ↓
Direct Supabase Queries + Realtime Subscriptions
    ├─ client_metrics (MTD data, updated by webhooks)
    ├─ sender_emails_cache (refreshed every 5 min by polling)
    ├─ client_leads (real-time via webhook)
    └─ client_registry (static config)
    ↓
Supabase Database (local, fast, always fresh)
    ↑
Background Workers (invisible to users):
    ├─ universal-bison-webhook (updates client_metrics in <5s)
    └─ poll-sender-emails (refreshes sender_emails_cache every 5 min)
```

**Benefits:**
1. ✅ Frontend queries local database (100x faster)
2. ✅ Data always fresh (<5s for KPIs, <5min for accounts)
3. ✅ Real-time updates via Supabase Realtime
4. ✅ No Email Bison API calls from frontend
5. ✅ Reduced API usage and costs

---

## Migration Strategy - PHASED APPROACH

### ❗ Critical Constraints

1. **Zero Downtime:** Production system serving 24 clients
2. **No Data Loss:** All existing functionality must remain
3. **Rollback Ready:** Must be able to revert instantly if issues arise
4. **User Transparency:** Users should not notice the migration
5. **Testing Required:** Each phase must be tested before proceeding

### 🚨 Breaking Change Analysis

#### Potential Risks:

**RISK 1: Data Schema Mismatch**
- **Issue:** Edge Functions return different field names than database tables
- **Example:** Edge Function returns `leadsGenerated`, DB has `positive_replies_mtd`
- **Impact:** 🔴 HIGH - Dashboard will show blank/wrong data
- **Mitigation:** Create transformation layer to map old field names to new ones

**RISK 2: Missing Data Columns**
- **Issue:** `client_metrics` table missing columns referenced by frontend
- **Current Missing:** `all_replies_mtd`, `bounced_mtd`, `unsubscribed_mtd` (✅ ADDED in Phase 2)
- **Impact:** 🟡 MEDIUM - Some metrics won't display
- **Mitigation:** Already added missing columns - verify all fields exist

**RISK 3: Client Portal Lead Sync**
- **Issue:** Leads may not be syncing correctly from webhooks
- **Impact:** 🔴 CRITICAL - Clients won't see their leads
- **Mitigation:** Resume paused lead sync rollout + verification

**RISK 4: Real-Time Subscription Performance**
- **Issue:** 24 clients × multiple dashboards = hundreds of concurrent subscriptions
- **Impact:** 🟢 LOW - Supabase handles this well
- **Mitigation:** Throttle subscription updates, use debouncing

**RISK 5: Cache Invalidation**
- **Issue:** Old in-memory cache may conflict with new database queries
- **Impact:** 🟡 MEDIUM - Users may see stale data briefly
- **Mitigation:** Clear all caches during migration, update cache keys

---

## Implementation Plan - 4-PHASE ROLLOUT

### Phase 1: Database Schema Verification (Week 1, Days 1-2)

**Goal:** Ensure all required data exists and matches frontend expectations

**Tasks:**

#### 1.1 Verify `client_metrics` Table Schema
```sql
-- Check all columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'client_metrics'
ORDER BY ordinal_position;

-- Required columns (from frontend analysis):
-- ✅ workspace_name
-- ✅ metric_date
-- ✅ metric_type
-- ✅ emails_sent_mtd
-- ✅ positive_replies_mtd
-- ✅ all_replies_mtd (added in Phase 2)
-- ✅ bounced_mtd (added in Phase 2)
-- ✅ unsubscribed_mtd (added in Phase 2)
-- ✅ projection_emails_eom
-- ✅ projection_positive_replies_eom
```

#### 1.2 Verify `sender_emails_cache` Table Has Data
```sql
-- Check polling is working
SELECT
  COUNT(*) as total_accounts,
  COUNT(DISTINCT workspace_name) as total_workspaces,
  MAX(last_synced_at) as most_recent_sync,
  MIN(last_synced_at) as oldest_sync
FROM sender_emails_cache;

-- Should show:
-- total_accounts: 4000+
-- total_workspaces: 24
-- most_recent_sync: < 5 minutes ago
```

#### 1.3 Verify `client_leads` Table Has Interested Leads
```sql
-- Check webhook is populating leads
SELECT
  workspace_name,
  COUNT(*) as interested_leads,
  MAX(date_received) as most_recent_lead
FROM client_leads
WHERE interested = true
GROUP BY workspace_name
ORDER BY workspace_name;

-- Should show leads for all 24 workspaces
```

#### 1.4 Create Field Mapping Documentation
**File:** `src/lib/fieldMappings.ts`

```typescript
// Maps Edge Function field names to database column names
export const KPI_FIELD_MAP = {
  // Edge Function → Database
  'leadsGenerated': 'positive_replies_mtd',
  'projectedReplies': 'projection_positive_replies_eom',
  'monthlyKPI': 'monthly_kpi_target', // from client_registry
  'currentProgress': 'mtd_leads_progress',
  'repliesProgress': 'projection_replies_progress',
  // ... complete mapping
};

export const EMAIL_ACCOUNT_FIELD_MAP = {
  // Edge Function → Database
  'Total Sent': 'emails_sent_count',
  'Total Replied': 'total_replied_count',
  'Unique Replied': 'unique_replied_count',
  'Tag - Email Provider': 'email_provider',
  'Tag - Reseller': 'reseller',
  // ... complete mapping
};
```

**Success Criteria:**
- ✅ All required columns exist in database
- ✅ Poll-sender-emails has synced 4000+ accounts in last 5 min
- ✅ Webhooks are populating client_leads with interested leads
- ✅ Field mapping document created

---

### Phase 2: Create Database Query Functions (Week 1, Days 3-4)

**Goal:** Build new query functions that fetch from Supabase instead of Edge Functions

**Tasks:**

#### 2.1 Create `src/services/realtimeDataService.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';
import { KPI_FIELD_MAP, EMAIL_ACCOUNT_FIELD_MAP } from '@/lib/fieldMappings';

// ============= KPI Data (Real-Time) =============

export async function fetchKPIDataRealtime(): Promise<DataFetchResult<KPIClient[]>> {
  const startTime = Date.now();

  try {
    // Query client_metrics + client_registry with JOIN
    const { data: metrics, error } = await supabase
      .from('client_metrics')
      .select(`
        *,
        client_registry!inner(
          workspace_name,
          display_name,
          monthly_kpi_target,
          monthly_sending_target,
          price_per_lead
        )
      `)
      .eq('metric_type', 'mtd')
      .eq('metric_date', new Date().toISOString().split('T')[0])
      .order('positive_replies_mtd', { ascending: false });

    if (error) throw error;

    // Transform database fields to match frontend expectations
    const transformedData = metrics.map(m => ({
      id: m.workspace_name,
      name: m.client_registry.display_name || m.workspace_name,
      leadsGenerated: m.positive_replies_mtd,
      projectedReplies: m.projection_positive_replies_eom,
      monthlyKPI: m.client_registry.monthly_kpi_target,
      currentProgress: m.mtd_leads_progress,
      // ... transform all fields using KPI_FIELD_MAP
    }));

    return {
      data: transformedData,
      success: true,
      cached: false,
      fresh: true,
      timestamp: new Date(),
      fetchDurationMs: Date.now() - startTime
    };
  } catch (error) {
    console.error('[KPI Realtime] Error:', error);
    return {
      data: null,
      success: false,
      cached: false,
      fresh: false,
      timestamp: new Date(),
      error: error.message
    };
  }
}

// ============= Email Infrastructure (Real-Time) =============

export async function fetchInfrastructureDataRealtime(): Promise<DataFetchResult<EmailAccount[]>> {
  const startTime = Date.now();

  try {
    // Query sender_emails_cache directly
    const { data: accounts, error } = await supabase
      .from('sender_emails_cache')
      .select('*')
      .order('last_synced_at', { ascending: false });

    if (error) throw error;

    // Transform to match current EmailAccount interface
    const transformedData = accounts.map(account => ({
      id: account.id,
      fields: {
        'Email': account.email_address,
        'Name': account.account_name,
        'Status': account.status,
        'Total Sent': account.emails_sent_count,
        'Total Replied': account.total_replied_count,
        'Unique Replied': account.unique_replied_count,
        'Bounced': account.bounced_count,
        'Unsubscribed': account.unsubscribed_count,
        'Interested Leads': account.interested_leads_count,
        'Tag - Email Provider': account.email_provider,
        'Tag - Reseller': account.reseller,
        'Client Name (from Client)': [account.workspace_name],
        'Daily Limit': account.daily_limit,
        'Domain': account.domain,
        'Price': account.price,
        'Bison Instance': account.bison_instance,
        // Calculated field
        'Reply Rate Per Account %': account.reply_rate_percentage
      }
    }));

    return {
      data: transformedData,
      success: true,
      cached: false,
      fresh: true,
      timestamp: new Date(),
      fetchDurationMs: Date.now() - startTime
    };
  } catch (error) {
    console.error('[Infrastructure Realtime] Error:', error);
    return {
      data: null,
      success: false,
      cached: false,
      fresh: false,
      timestamp: new Date(),
      error: error.message
    };
  }
}

// ============= Volume Data (Real-Time) =============

export async function fetchVolumeDataRealtime(): Promise<DataFetchResult<VolumeClient[]>> {
  // Similar pattern: Query client_metrics + client_registry
  // Transform to VolumeClient interface
  // ... implementation
}
```

#### 2.2 Create Real-Time Subscription Hooks

**File:** `src/hooks/useRealtimeSubscription.ts`

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeClientMetrics(workspaceName?: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Subscribe to changes
    const channel = supabase
      .channel('client-metrics-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'client_metrics',
        filter: workspaceName ? `workspace_name=eq.${workspaceName}` : undefined
      }, (payload) => {
        console.log('Real-time update received:', payload);
        // Update local state
        handleRealtimeUpdate(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceName]);

  return { data, loading };
}

export function useRealtimeSenderEmails() {
  // Similar pattern for sender_emails_cache
  // Debounce updates to avoid excessive re-renders
}

export function useRealtimeLeads(workspaceName: string) {
  // Similar pattern for client_leads
  // Filter by workspace_name
}
```

**Success Criteria:**
- ✅ `realtimeDataService.ts` created with all fetch functions
- ✅ Field transformations correctly map DB → Frontend
- ✅ Real-time subscription hooks created
- ✅ Unit tests pass for transformation logic

---

### Phase 3: Gradual Frontend Migration (Week 1, Days 5-7)

**Goal:** Switch dashboards one-by-one from Edge Functions to database queries

**Migration Order (Lowest Risk → Highest Risk):**

#### 3.1 Email Infrastructure Dashboard (FIRST - Biggest Win)

**Why First:** Slowest dashboard (30-60s), biggest performance gain, internal users only

**Changes Required:**

**File:** `src/services/dataService.ts`
```typescript
// BEFORE:
export async function fetchInfrastructureData(force: boolean = false) {
  const { data, error } = await supabase.functions.invoke('hybrid-email-accounts-v2');
  // ...
}

// AFTER:
import { fetchInfrastructureDataRealtime } from './realtimeDataService';

export async function fetchInfrastructureData(force: boolean = false) {
  // Use new realtime function instead of Edge Function
  return fetchInfrastructureDataRealtime();
}
```

**File:** `src/pages/EmailAccountsPage.tsx`
```typescript
// Add real-time subscription
import { useRealtimeSenderEmails } from '@/hooks/useRealtimeSubscription';

const SendingAccountsInfrastructure = () => {
  const { data: realtimeAccounts, loading: realtimeLoading } = useRealtimeSenderEmails();

  // Merge real-time updates with context data
  // ...
};
```

**Testing:**
1. Open Email Infrastructure Dashboard
2. Verify load time < 2 seconds (down from 30-60s)
3. Verify all 4000+ accounts display correctly
4. Verify provider analysis calculations match old system
5. Run `poll-sender-emails` manually, verify dashboard auto-updates

#### 3.2 KPI Dashboard (SECOND - Internal Only)

**Why Second:** Internal users, easy to rollback, well-tested data

**Changes Required:**

**File:** `src/services/dataService.ts`
```typescript
import { fetchKPIDataRealtime } from './realtimeDataService';

export async function fetchKPIData(force: boolean = false) {
  return fetchKPIDataRealtime();
}
```

**File:** `src/pages/KPIDashboard.tsx`
```typescript
import { useRealtimeClientMetrics } from '@/hooks/useRealtimeSubscription';

// Add real-time updates for all metrics
```

**Testing:**
1. Open KPI Dashboard
2. Verify all 24 clients display
3. Verify projections calculate correctly
4. Trigger webhook (send test email via Email Bison)
5. Verify KPI increments in dashboard without refresh

#### 3.3 Volume Dashboard (THIRD - Internal Only)

**Why Third:** Similar to KPI, internal users only

**Changes:** Similar pattern to KPI Dashboard

#### 3.4 Client Portal Leads (FOURTH - MOST CRITICAL)

**Why Fourth:** External client-facing, must be 100% correct

**Current State:**
- ✅ Already queries `client_leads` directly from Supabase
- ⚠️ Needs verification that webhooks are populating leads correctly

**Changes Required:**

**Resume Paused Lead Sync Rollout:**
1. Verify `universal-bison-webhook` is processing `lead_interested` events
2. Test with one client (Devin Hodo - previously verified 42/42 leads)
3. Check `webhook_delivery_log` for successful processing
4. Verify leads appear in Client Portal within 5 seconds
5. Roll out webhook registration to all 24 clients

**File:** `src/pages/ClientPortalPage.tsx`
```typescript
// Add real-time subscription for leads
import { useRealtimeLeads } from '@/hooks/useRealtimeSubscription';

const ClientPortalPage = () => {
  const { data: realtimeLeads } = useRealtimeLeads(workspace);

  // Merge real-time updates with existing fetch
  useEffect(() => {
    if (realtimeLeads) {
      setLeads(currentLeads => mergeLeads(currentLeads, realtimeLeads));
    }
  }, [realtimeLeads]);
};
```

**Testing (CRITICAL - Client Facing):**
1. Test with internal workspace first (ApolloTechné or Test Rob Russell)
2. Send test interested reply via Email Bison
3. Verify lead appears in Client Portal within 5 seconds
4. Verify conversation URL works
5. Verify pipeline drag-and-drop still works
6. Test with 3 pilot clients before full rollout
7. Monitor `webhook_health` table for success rates

#### 3.5 Revenue Dashboard (FIFTH - Low Priority)

**Why Last:** Already uses Supabase mostly, least critical

**Changes:** Minimal - already queries `client_registry` directly

**Success Criteria:**
- ✅ All 5 dashboards migrated to database queries
- ✅ Load times improved 15-60x
- ✅ No user-reported issues
- ✅ Real-time updates working
- ✅ Client Portal leads syncing correctly

---

### Phase 4: Cleanup & Optimization (Week 2)

**Goal:** Remove old code, optimize performance, add monitoring

#### 4.1 Deprecate Old Edge Functions

**DO NOT DELETE** (keep for emergency rollback):
- `hybrid-workspace-analytics`
- `hybrid-email-accounts-v2`
- `volume-dashboard-data`

**Instead:**
- Add deprecation warning to Edge Function code
- Stop invoking from frontend
- Monitor usage (should drop to zero)
- Archive after 30 days of zero usage

#### 4.2 Remove In-Memory Cache

**File:** `src/services/dataService.ts`
```typescript
// REMOVE: Old cache logic (DataCache class)
// Database queries are already fast, no need for extra caching
// Supabase handles caching internally
```

#### 4.3 Add Performance Monitoring

**File:** `src/lib/analytics.ts`
```typescript
export function trackDashboardLoadTime(dashboard: string, durationMs: number) {
  console.log(`[Analytics] ${dashboard} loaded in ${durationMs}ms`);
  // Send to analytics service if available
}
```

#### 4.4 Add Health Checks

**File:** `src/hooks/useSystemHealth.ts`
```typescript
export function useSystemHealth() {
  const [health, setHealth] = useState({
    webhookStatus: 'unknown',
    pollingStatus: 'unknown',
    lastDataUpdate: null
  });

  useEffect(() => {
    // Query webhook_health table
    const checkHealth = async () => {
      const { data } = await supabase
        .from('webhook_health')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      setHealth({
        webhookStatus: data?.is_healthy ? 'healthy' : 'degraded',
        lastWebhook: data?.last_webhook_at,
        // ...
      });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  return health;
}
```

#### 4.5 Update Documentation

- Update README with new architecture diagram
- Document real-time subscription usage
- Create troubleshooting guide for common issues

**Success Criteria:**
- ✅ Old Edge Functions deprecated (not deleted)
- ✅ Performance monitoring added
- ✅ Health checks showing system status
- ✅ Documentation updated

---

## Rollback Strategy

### If Issues Arise During Migration:

**Quick Rollback (< 5 minutes):**

```typescript
// In src/services/dataService.ts
const USE_REALTIME_DATA = false; // Toggle this to revert

export async function fetchKPIData(force: boolean = false) {
  if (USE_REALTIME_DATA) {
    return fetchKPIDataRealtime(); // New system
  } else {
    return fetchKPIDataOld(force); // Old Edge Function system
  }
}
```

**Feature Flags by Dashboard:**
```typescript
const FEATURE_FLAGS = {
  useRealtimeInfrastructure: true, // Toggle per dashboard
  useRealtimeKPI: true,
  useRealtimeVolume: true,
  useRealtimeClientPortal: true,
};
```

**Emergency Rollback Steps:**
1. Set all feature flags to `false`
2. Deploy to production (< 2 minutes)
3. Verify old system working
4. Investigate issue offline
5. Re-enable when fixed

---

## Testing Checklist

### Pre-Migration Tests:

- [ ] Verify 4000+ accounts in `sender_emails_cache`
- [ ] Verify polling runs every 5 minutes
- [ ] Verify webhooks processing events
- [ ] Verify `increment_metric()` function works
- [ ] Create test workspace for safe testing

### Per-Dashboard Tests:

**Email Infrastructure:**
- [ ] Load time < 2 seconds
- [ ] All 4000+ accounts display
- [ ] Provider analysis matches old calculations
- [ ] Filter by client works
- [ ] Filter by provider works
- [ ] 0% reply rate filter works
- [ ] Export to CSV works

**KPI Dashboard:**
- [ ] All 24 clients display
- [ ] Projections calculate correctly
- [ ] Progress bars show correct percentages
- [ ] Sorting by different metrics works
- [ ] Real-time updates when webhook fires

**Volume Dashboard:**
- [ ] Sending volume numbers match Email Bison
- [ ] Today's sending shows correctly
- [ ] Projections calculate correctly
- [ ] Color coding (green/yellow/red) correct

**Client Portal:**
- [ ] Interested leads display correctly
- [ ] Conversation URLs work
- [ ] Pipeline drag-and-drop works
- [ ] Lead appears <5s after webhook fires
- [ ] Real-time updates don't cause flicker

### Post-Migration Tests:

- [ ] No console errors
- [ ] Load times improved 15-60x
- [ ] Memory usage acceptable (check DevTools)
- [ ] No WebSocket connection issues
- [ ] Works in Safari, Chrome, Firefox
- [ ] Works on mobile devices

---

## Success Metrics

### Performance Targets:

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Email Infrastructure Load | 30-60s | <2s | ⏳ Pending |
| KPI Dashboard Load | 5-10s | <500ms | ⏳ Pending |
| Volume Dashboard Load | 3-5s | <300ms | ⏳ Pending |
| Client Portal Load | 2-3s | <200ms | ⏳ Pending |
| Lead Sync Latency | Manual | <5s | ⏳ Pending |
| Dashboard Auto-Update | None | Real-time | ⏳ Pending |

### User Experience Targets:

| Metric | Current | Target |
|--------|---------|--------|
| Manual refresh needed | Yes | No |
| Data freshness | 2 min (cache) | <5s (webhooks) |
| Email account freshness | Manual | <5 min (polling) |
| Client satisfaction | Baseline | +20% |

---

## Paused Task: Lead Sync Rollout

**Original Task:** "Roll out fixed lead sync to all 24 clients"
**Status:** PAUSED after Phase 1 & 2 backend implementation
**Resuming In:** Phase 3.4 (Client Portal Migration)

**What Was Done:**
- ✅ Webhook bug fixed (`lead_interested` not `LEAD_INTERESTED`)
- ✅ Universal webhook handler deployed
- ✅ Tested with Devin Hodo (42/42 leads synced correctly)

**What Needs to Be Done:**
1. Register `universal-bison-webhook` URL with Email Bison for all 24 workspaces
2. Subscribe to `lead_interested` event for each workspace
3. Verify webhook delivery logs show successful processing
4. Test Client Portal shows leads within 5 seconds
5. Monitor `webhook_health` table for all 24 clients

**Integration with Frontend Plan:**
- Phase 3.4 will add real-time subscriptions to Client Portal
- Leads will auto-update without refresh when webhook fires
- This completes the end-to-end real-time lead flow

---

## Dependencies & Prerequisites

### Required Before Starting:

1. ✅ Phase 1 & 2 backend complete (webhooks + polling running)
2. ✅ `increment_metric()` function deployed
3. ✅ `sender_emails_cache` has data (1000+ accounts)
4. ✅ `client_metrics` has MTD data for all 24 clients
5. ✅ pg_cron job running every 5 minutes

### Environment Variables Needed:

```bash
# Already configured in Supabase Edge Functions
SUPABASE_URL=https://gjqbbgrfhijescaouqkx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=*** (for webhook writes)
MAVERICK_BISON_API_KEY=*** (for polling)
LONG_RUN_BISON_API_KEY=*** (for polling)
```

### External Dependencies:

- Email Bison webhook registration (Phase 3.4)
- Supabase Realtime (should be enabled by default)
- Supabase connection pooling (already configured)

---

## Timeline Estimate

| Phase | Duration | Risk | Rollback Time |
|-------|----------|------|---------------|
| 1. Schema Verification | 1 day | 🟢 Low | N/A |
| 2. Query Functions | 2 days | 🟡 Medium | Instant |
| 3.1 Infrastructure | 1 day | 🟡 Medium | <5 min |
| 3.2 KPI Dashboard | 1 day | 🟡 Medium | <5 min |
| 3.3 Volume Dashboard | 1 day | 🟡 Medium | <5 min |
| 3.4 Client Portal | 2 days | 🔴 High | <5 min |
| 3.5 Revenue Dashboard | 0.5 days | 🟢 Low | <5 min |
| 4. Cleanup | 2 days | 🟢 Low | N/A |
| **TOTAL** | **10.5 days** | | |

**Conservative Estimate:** 2 weeks
**Aggressive Estimate:** 1 week (if no issues)

---

## Conclusion

This plan provides a **comprehensive, zero-downtime migration** from slow Edge Functions to fast real-time database queries.

**Key Principles:**
1. ✅ Gradual rollout (one dashboard at a time)
2. ✅ Instant rollback capability
3. ✅ Extensive testing at each phase
4. ✅ User transparency (no downtime)
5. ✅ Performance gains 15-60x

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1: Schema verification
3. Create field mapping documentation
4. Build new query functions
5. Migrate dashboards one-by-one

**Final Outcome:**
- Users see instant load times
- Data always fresh (<5s)
- Real-time auto-updates
- Client Portal shows correct leads immediately
- No more manual refresh buttons needed

Ready to begin implementation pending approval.
