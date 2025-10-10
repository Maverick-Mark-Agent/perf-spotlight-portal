# Real-Time Data Synchronization: Comprehensive Implementation Plan v2
**Date:** October 9, 2025 (Updated after complete audit)
**Goal:** Transform Supabase database into a real-time mirror of Email Bison
**Status:** Research Complete → Implementation Ready

---

## Executive Summary

This plan transforms our Supabase database from a **manually-synced cache** into a **real-time source of truth** that mirrors Email Bison with <5 second latency for critical data and <5 minute latency for infrastructure data.

**Current State:**
- ✅ Webhooks active for 24/24 clients (interested leads only)
- ✅ Email account performance tracked (per-account sends, replies, reply rates)
- ✅ Provider performance analysis (Gmail vs Outlook comparison)
- ⚠️ Manual sync required for campaign metrics, email volume
- ⚠️ Email account data refreshed manually (30-60s for 4000+ accounts)
- ❌ No automatic failover if webhooks fail
- ❌ Historical data gaps (midnight-3AM)

**Target State:**
- ✅ Real-time webhooks for ALL critical events (sends, replies, bounces, unsubscribes)
- ✅ Email account infrastructure auto-refresh (5-minute polling)
- ✅ Provider performance trending (historical tracking)
- ✅ Automatic fallback polling if webhooks fail
- ✅ Smart caching with background prefetch
- ✅ Continuous data sync (no gaps)
- ✅ Self-healing system with monitoring alerts

---

## Complete Data Tracking Audit

### ✅ What We're Already Tracking

#### 1. Email Account Infrastructure (VERIFIED ✅)
**Source:** `/api/sender-emails` endpoint
**Dashboard:** [EmailAccountsPage.tsx](../src/pages/EmailAccountsPage.tsx)
**Status:** Manual refresh, 4000+ accounts

**Per-Account Metrics:**
```typescript
{
  // Performance (FROM EMAIL BISON API)
  emails_sent_count: number,        // Total sent from this account
  total_replied_count: number,      // Total replies to this account
  unique_replied_count: number,     // Unique contacts who replied
  bounced_count: number,            // Bounces from this account
  unsubscribed_count: number,       // Unsubscribes from this account
  interested_leads_count: number,   // Interested replies from this account

  // Status
  status: 'Connected' | 'Disconnected' | 'Failed',
  daily_limit: number,              // Current warmup limit

  // Identity
  email: string,
  name: string,
  type: string,
  tags: Array<{name: string}>       // Provider, Reseller tags
}
```

**Calculated Analytics:**
- Reply Rate per Account: `(unique_replied_count / emails_sent_count) * 100`
- Provider Performance (Gmail, Outlook, etc.): Weighted average reply rate
- Client Account Distribution: Total accounts per client
- Sending Capacity Analysis: Theoretical vs actual limits

**Current Limitations:**
- ❌ No automatic refresh (user must click button)
- ❌ No historical tracking (can't see trends over time)
- ❌ No real-time account status updates
- ❌ Takes 30-60 seconds to fetch all accounts

#### 2. Client Workspace KPIs (VERIFIED ✅)
**Source:** `/api/workspaces/v1.1/stats` endpoint
**Function:** `hybrid-workspace-analytics/index.ts`
**Status:** Daily cron (3 AM UTC) + 2-min cache

**Metrics:**
- Interested replies (PRIMARY KPI)
- Emails sent (volume tracking)
- Total replies (all replies, not just interested)
- Bounces
- Unsubscribes
- ❌ Opens (DISABLED - always 0)

#### 3. Lead Pipeline Data (VERIFIED ✅)
**Source:** `/api/leads` endpoint
**Table:** `client_leads`
**Status:** Real-time webhook for interested + daily batch

**Fields:**
- Contact info (name, email, phone, title, company)
- Pipeline stage (new, contacted, replied, interested, etc.)
- Conversation URL
- Custom variables
- Tags

#### 4. Campaign Data (VERIFIED ✅)
**Source:** `/api/campaigns` endpoint
**Status:** Background tracking, not heavily displayed

#### 5. Email Account Metadata (Supabase Only)
**Table:** `email_account_metadata`
**Purpose:** Manual overrides for pricing and sending limits

#### 6. Client Registry (Supabase Only)
**Table:** `client_registry`
**Purpose:** Client configuration, targets, API keys

---

## Data Freshness Requirements (UPDATED)

| Data Type | Current Latency | Target Latency | Method | Priority |
|-----------|----------------|----------------|--------|----------|
| **Interested Leads** | <2s (webhook ✅) | <5s | Webhook | 🔴 CRITICAL |
| **Email Sent Count** | 3 hours (cron) | <5s | Webhook | 🔴 CRITICAL |
| **Reply Count** | 3 hours (cron) | <5s | Webhook | 🔴 CRITICAL |
| **Bounce Count** | 3 hours (cron) | <5s | Webhook | 🟡 HIGH |
| **Unsubscribe Count** | 3 hours (cron) | <5s | Webhook | 🟡 HIGH |
| **Email Account Metrics** | Manual refresh | <5 min | Polling | 🟡 HIGH |
| **Account Status Changes** | Manual refresh | <30s | Webhook | 🟡 HIGH |
| **Provider Performance** | Manual refresh | <5 min | Polling | 🟢 MEDIUM |
| **Campaign Stats** | 3 hours (cron) | <10 min | Polling | 🟢 MEDIUM |

---

## Target Architecture (5-Layer System)

### Layer 1: Real-Time Webhooks (PRIMARY)
**Latency:** <5 seconds
**Events to Track:** 8 total (5 KPI + 3 infrastructure)

```typescript
// KPI Events (existing plan)
'email_sent'           // Increment workspace emails_sent_mtd
'lead_replied'         // Increment workspace replies_mtd
'lead_interested'      // ✅ ALREADY ACTIVE - Upsert to client_leads
'email_bounced'        // Increment workspace bounces_mtd
'lead_unsubscribed'    // Increment workspace unsubscribes_mtd

// 🆕 Infrastructure Events (NEW)
'email_account_added'        // New account connected → Insert to sender_emails_cache
'email_account_disconnected' // Account failed → Update status, alert admins
'email_account_reconnected'  // Account restored → Update status
```

### Layer 2: Intelligent Polling (FAILSAFE)
**Latency:** 5-10 minutes
**Purpose:** Catch missed webhooks, refresh bulk data

```typescript
// KPI Polling (if webhook fails)
poll-workspace-metrics: Every 5 min if no webhook in 10 min

// 🆕 Email Account Polling (NEW)
poll-sender-emails: Every 5 min
  → Fetch /api/sender-emails for all workspaces
  → Upsert to sender_emails_cache
  → Calculate provider performance metrics
  → Update last_synced_at timestamp
```

### Layer 3: Smart Caching
**TTL:** 60 seconds with background prefetch

```typescript
// Existing caching (update TTL)
client_metrics: 60s TTL
client_leads: No cache (real-time)

// 🆕 Email Account Caching (NEW)
sender_emails_cache: 5-min refresh via polling
provider_performance_history: Daily snapshots
```

### Layer 4: Supabase Realtime (Frontend)
**Latency:** <1 second
**Method:** Postgres subscriptions via websockets

```typescript
// Frontend real-time subscriptions
supabase.channel('client-metrics-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'client_metrics'
  }, (payload) => {
    // Update dashboard without refresh
  })
  .subscribe()

// 🆕 Email Account Real-time (NEW)
supabase.channel('sender-emails-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'sender_emails_cache'
  }, (payload) => {
    // Update infrastructure dashboard without refresh
  })
  .subscribe()
```

### Layer 5: Monitoring & Self-Healing
**Check Interval:** Every 1 minute
**Actions:** Alerts, automatic failover

```typescript
// Health checks
- Webhook delivery rate (should be >95%)
- Last webhook timestamp (should be <10 min ago)
- Polling success rate (should be 100%)
- Cache hit rate (should be >80%)

// 🆕 Infrastructure Health (NEW)
- Email account sync lag (should be <5 min)
- Account disconnect rate (alert if >5% of accounts fail)
- Provider performance trends (alert if reply rate drops >20%)
```

---

## New Database Tables Required

### 🆕 1. sender_emails_cache
**Purpose:** Store email account snapshots for fast access and historical tracking

```sql
CREATE TABLE sender_emails_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  email_address text NOT NULL,
  account_name text,
  workspace_name text NOT NULL,
  bison_workspace_id integer NOT NULL,
  bison_instance text NOT NULL, -- 'Maverick' or 'Long Run'

  -- Performance metrics (from Email Bison API)
  emails_sent_count integer DEFAULT 0,
  total_replied_count integer DEFAULT 0,
  unique_replied_count integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  unsubscribed_count integer DEFAULT 0,
  interested_leads_count integer DEFAULT 0,
  total_leads_contacted_count integer DEFAULT 0,

  -- Calculated metrics
  reply_rate_percentage decimal(5,2) GENERATED ALWAYS AS (
    CASE WHEN emails_sent_count > 0
    THEN (unique_replied_count::decimal / emails_sent_count::decimal) * 100
    ELSE 0 END
  ) STORED,

  -- Status
  status text NOT NULL, -- 'Connected', 'Disconnected', 'Failed'
  daily_limit integer DEFAULT 0,
  account_type text,

  -- Provider/Reseller info
  email_provider text, -- 'Gmail', 'Outlook', 'Microsoft', etc.
  reseller text,       -- 'CheapInboxes', 'Zapmail', 'ScaledMail', 'Mailr'
  domain text,

  -- Pricing (joined from email_account_metadata)
  price decimal(10,2),
  volume_per_account integer,

  -- Tags
  tags jsonb DEFAULT '[]'::jsonb,

  -- Timestamps
  last_synced_at timestamp DEFAULT NOW(),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),

  UNIQUE(email_address, workspace_name)
);

-- Indexes for fast queries
CREATE INDEX idx_sender_emails_cache_workspace ON sender_emails_cache(workspace_name);
CREATE INDEX idx_sender_emails_cache_provider ON sender_emails_cache(email_provider);
CREATE INDEX idx_sender_emails_cache_status ON sender_emails_cache(status);
CREATE INDEX idx_sender_emails_cache_reply_rate ON sender_emails_cache(reply_rate_percentage);
CREATE INDEX idx_sender_emails_cache_last_synced ON sender_emails_cache(last_synced_at);

-- RLS policies
ALTER TABLE sender_emails_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on sender_emails_cache"
  ON sender_emails_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update timestamp trigger
CREATE TRIGGER set_updated_at_sender_emails_cache
  BEFORE UPDATE ON sender_emails_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### 🆕 2. provider_performance_history
**Purpose:** Track provider performance over time for trending analysis

```sql
CREATE TABLE provider_performance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider info
  email_provider text NOT NULL, -- 'Gmail', 'Outlook', etc.
  bison_instance text NOT NULL, -- 'Maverick' or 'Long Run'

  -- Aggregate metrics
  total_accounts integer NOT NULL,
  active_accounts integer NOT NULL,
  total_sent integer NOT NULL,
  total_replies integer NOT NULL,
  unique_replies integer NOT NULL,
  total_bounces integer NOT NULL,

  -- Calculated metrics
  avg_reply_rate decimal(5,2) NOT NULL,
  avg_emails_per_account decimal(10,2),

  -- Sending capacity
  total_daily_limit integer DEFAULT 0,
  total_volume_capacity integer DEFAULT 0,
  utilization_percentage decimal(5,2),

  -- Snapshot metadata
  snapshot_date date NOT NULL,
  created_at timestamp DEFAULT NOW(),

  UNIQUE(email_provider, bison_instance, snapshot_date)
);

-- Indexes
CREATE INDEX idx_provider_history_date ON provider_performance_history(snapshot_date DESC);
CREATE INDEX idx_provider_history_provider ON provider_performance_history(email_provider);
CREATE INDEX idx_provider_history_reply_rate ON provider_performance_history(avg_reply_rate DESC);

-- RLS
ALTER TABLE provider_performance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on provider_performance_history"
  ON provider_performance_history
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 🆕 3. webhook_delivery_log (from original plan)
**Purpose:** Track all webhook deliveries for monitoring

```sql
CREATE TABLE webhook_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  workspace_name text,
  payload jsonb NOT NULL,
  processing_time_ms integer,
  success boolean NOT NULL,
  error_message text,
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_webhook_log_event_type ON webhook_delivery_log(event_type);
CREATE INDEX idx_webhook_log_created_at ON webhook_delivery_log(created_at DESC);
CREATE INDEX idx_webhook_log_success ON webhook_delivery_log(success);
```

### 🆕 4. webhook_health (from original plan)
**Purpose:** Track webhook health metrics per workspace

```sql
CREATE TABLE webhook_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_name text UNIQUE NOT NULL,
  last_webhook_at timestamp,
  webhook_count_24h integer DEFAULT 0,
  success_rate_24h decimal(5,2) DEFAULT 100,
  is_healthy boolean DEFAULT true,
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_webhook_health_updated ON webhook_health(updated_at DESC);
CREATE INDEX idx_webhook_health_healthy ON webhook_health(is_healthy);
```

---

## Implementation Roadmap (UPDATED)

### Phase 1: Core Real-Time Foundation (Week 1)

#### Day 1-2: Database Setup
- [x] Create `sender_emails_cache` table with indexes
- [x] Create `provider_performance_history` table
- [x] Create `webhook_delivery_log` table
- [x] Create `webhook_health` table
- [x] Set up RLS policies
- [x] Test table performance with sample data

#### Day 3-4: Fix Existing Webhook & Expand
- [x] **Fix bug in `bison-interested-webhook`** (line 77: `'LEAD_INTERESTED'` → `'lead_interested'`)
- [x] Create universal webhook handler for 8 events:
  ```typescript
  // supabase/functions/universal-bison-webhook/index.ts

  switch (payload.event?.type) {
    // KPI Events
    case 'email_sent':
      await incrementMetric('emails_sent_mtd', workspace_name);
      break;

    case 'lead_replied':
      await incrementMetric('replies_mtd', workspace_name);
      await upsertLead(leadData, 'replied');
      break;

    case 'lead_interested':
      await incrementMetric('interested_mtd', workspace_name);
      await upsertLead(leadData, 'interested');
      break;

    case 'email_bounced':
      await incrementMetric('bounces_mtd', workspace_name);
      await updateLeadStatus(leadEmail, 'bounced');
      break;

    case 'lead_unsubscribed':
      await incrementMetric('unsubscribes_mtd', workspace_name);
      await updateLeadStatus(leadEmail, 'unsubscribed');
      break;

    // 🆕 Infrastructure Events
    case 'email_account_added':
      await insertSenderEmailCache(accountData);
      await logEvent('account_added', workspace_name);
      break;

    case 'email_account_disconnected':
      await updateSenderEmailStatus(accountEmail, 'Disconnected');
      await sendSlackAlert(`🚨 Account disconnected: ${accountEmail}`);
      break;

    case 'email_account_reconnected':
      await updateSenderEmailStatus(accountEmail, 'Connected');
      await logEvent('account_reconnected', workspace_name);
      break;

    default:
      console.warn(`Unknown event type: ${payload.event?.type}`);
  }
  ```

#### Day 5: Register Webhooks with Email Bison
- [x] Update webhook URLs for all 24 workspaces
- [x] Subscribe to 8 events (5 KPI + 3 infrastructure)
- [x] Test webhook delivery with sample events
- [x] Verify `snake_case` event types work

#### Day 6-7: Deploy & Monitor
- [x] Deploy universal webhook handler
- [x] Monitor webhook delivery logs
- [x] Verify metrics incrementing correctly
- [x] Test error handling and retries

**Success Criteria:**
- ✅ All 8 webhook events processing correctly
- ✅ <5s latency from Email Bison to Supabase
- ✅ >95% webhook success rate
- ✅ Event type casing bug fixed

---

### Phase 2: Email Account Infrastructure (Week 2)

#### Day 1-2: Polling Function for Sender Emails
```typescript
// supabase/functions/poll-sender-emails/index.ts

export async function pollSenderEmails() {
  const startTime = Date.now();

  // 1. Fetch all active workspaces from client_registry
  const { data: workspaces } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
    .eq('is_active', true);

  const results = [];

  for (const workspace of workspaces) {
    try {
      // 2. Switch to workspace context
      await fetch(`${bisonBaseUrl}/workspaces/v1.1/switch-workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${workspace.bison_api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ team_id: workspace.bison_workspace_id })
      });

      // 3. Fetch sender emails with pagination
      let nextUrl = `${bisonBaseUrl}/sender-emails?per_page=100`;
      let accountsFetched = 0;

      while (nextUrl) {
        const response = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${workspace.bison_api_key}`,
            'Accept': 'application/json'
          }
        });

        const data = await response.json();
        const accounts = data.data || [];

        // 4. Upsert each account to sender_emails_cache
        for (const account of accounts) {
          await supabase
            .from('sender_emails_cache')
            .upsert({
              email_address: account.email,
              account_name: account.name,
              workspace_name: workspace.workspace_name,
              bison_workspace_id: workspace.bison_workspace_id,
              bison_instance: workspace.bison_instance,

              // Performance metrics
              emails_sent_count: account.emails_sent_count || 0,
              total_replied_count: account.total_replied_count || 0,
              unique_replied_count: account.unique_replied_count || 0,
              bounced_count: account.bounced_count || 0,
              unsubscribed_count: account.unsubscribed_count || 0,
              interested_leads_count: account.interested_leads_count || 0,
              total_leads_contacted_count: account.total_leads_contacted_count || 0,

              // Status
              status: account.status,
              daily_limit: account.daily_limit || 0,
              account_type: account.type,

              // Provider info (extract from tags)
              email_provider: extractProvider(account.tags),
              reseller: extractReseller(account.tags),
              domain: account.email.split('@')[1],

              // Tags
              tags: account.tags,

              // Timestamps
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'email_address,workspace_name'
            });

          accountsFetched++;
        }

        nextUrl = data.links?.next || null;
      }

      results.push({
        workspace: workspace.workspace_name,
        accounts_synced: accountsFetched,
        duration_ms: Date.now() - startTime
      });

    } catch (error) {
      console.error(`Failed to sync ${workspace.workspace_name}:`, error);
      results.push({
        workspace: workspace.workspace_name,
        error: error.message
      });
    }
  }

  return { results, total_duration_ms: Date.now() - startTime };
}
```

#### Day 3: Schedule Polling with pg_cron
```sql
-- Run every 5 minutes
SELECT cron.schedule(
  'poll-sender-emails-every-5-min',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

#### Day 4-5: Provider Performance Trending
```typescript
// supabase/functions/calculate-provider-performance/index.ts

export async function calculateProviderPerformance() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Query sender_emails_cache grouped by provider
  const { data: providerStats } = await supabase.rpc('aggregate_provider_stats');

  // 2. Insert daily snapshot
  for (const stat of providerStats) {
    await supabase
      .from('provider_performance_history')
      .upsert({
        email_provider: stat.email_provider,
        bison_instance: stat.bison_instance,
        total_accounts: stat.total_accounts,
        active_accounts: stat.active_accounts,
        total_sent: stat.total_sent,
        total_replies: stat.total_replies,
        unique_replies: stat.unique_replies,
        total_bounces: stat.total_bounces,
        avg_reply_rate: stat.avg_reply_rate,
        avg_emails_per_account: stat.avg_emails_per_account,
        total_daily_limit: stat.total_daily_limit,
        total_volume_capacity: stat.total_volume_capacity,
        utilization_percentage: stat.utilization_percentage,
        snapshot_date: today
      }, {
        onConflict: 'email_provider,bison_instance,snapshot_date'
      });
  }
}
```

#### Day 6-7: Update Frontend to Use Cache
```typescript
// src/pages/EmailAccountsPage.tsx

// Replace direct API call with Supabase query
const fetchEmailAccounts = async () => {
  const { data, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .order('last_synced_at', { ascending: false });

  if (error) throw error;

  // Subscribe to real-time updates
  const subscription = supabase
    .channel('sender-emails-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'sender_emails_cache'
    }, (payload) => {
      // Update state without full refresh
      updateAccountInState(payload.new);
    })
    .subscribe();

  return data;
};
```

**Success Criteria:**
- ✅ Email accounts auto-refresh every 5 minutes
- ✅ <5-minute data freshness for account metrics
- ✅ Provider performance historical data available
- ✅ Frontend uses cached data (instant load)
- ✅ Real-time updates via Supabase Realtime

---

### Phase 3: Monitoring & Self-Healing (Week 3)

#### Day 1-2: Health Check Dashboard
```typescript
// supabase/functions/check-system-health/index.ts

export async function checkSystemHealth() {
  const checks = [];

  // 1. Webhook health
  const { data: webhookHealth } = await supabase
    .from('webhook_delivery_log')
    .select('success')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const webhookSuccessRate = webhookHealth.filter(w => w.success).length / webhookHealth.length * 100;
  checks.push({
    name: 'Webhook Delivery',
    status: webhookSuccessRate >= 95 ? 'healthy' : 'degraded',
    value: `${webhookSuccessRate.toFixed(1)}%`
  });

  // 2. Email account sync lag
  const { data: accountSyncLag } = await supabase
    .from('sender_emails_cache')
    .select('last_synced_at')
    .order('last_synced_at', { ascending: true })
    .limit(1)
    .single();

  const lagMinutes = (Date.now() - new Date(accountSyncLag.last_synced_at).getTime()) / 60000;
  checks.push({
    name: 'Account Sync Lag',
    status: lagMinutes < 5 ? 'healthy' : 'degraded',
    value: `${lagMinutes.toFixed(1)} min`
  });

  // 3. Account disconnect rate
  const { data: accountStats } = await supabase.rpc('get_account_status_stats');
  const disconnectRate = (accountStats.disconnected / accountStats.total) * 100;
  checks.push({
    name: 'Account Health',
    status: disconnectRate < 5 ? 'healthy' : 'warning',
    value: `${disconnectRate.toFixed(1)}% disconnected`
  });

  // 4. Provider performance trends
  const { data: providerTrends } = await supabase.rpc('check_provider_reply_rate_drop');
  const providerIssues = providerTrends.filter(p => p.drop_percentage > 20);
  checks.push({
    name: 'Provider Performance',
    status: providerIssues.length === 0 ? 'healthy' : 'warning',
    value: providerIssues.length > 0
      ? `${providerIssues.length} providers declining`
      : 'All providers stable'
  });

  return { checks, overall_status: checks.every(c => c.status === 'healthy') ? 'healthy' : 'degraded' };
}
```

#### Day 3-4: Slack Alerts Integration
```typescript
// supabase/functions/send-health-alerts/index.ts

export async function sendHealthAlerts() {
  const health = await checkSystemHealth();

  if (health.overall_status !== 'healthy') {
    const message = {
      text: '⚠️ System Health Alert',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*System Health Status: Degraded*'
          }
        },
        ...health.checks
          .filter(c => c.status !== 'healthy')
          .map(check => ({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${check.name}:* ${check.status}\n${check.value}`
            }
          }))
      ]
    };

    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }
}
```

#### Day 5: Failover Logic
```typescript
// If webhooks haven't fired in 10 minutes, trigger emergency poll
SELECT cron.schedule(
  'emergency-poll-if-webhook-silent',
  '* * * * *', -- Every minute
  $$
  SELECT CASE
    WHEN (
      SELECT COUNT(*) FROM webhook_delivery_log
      WHERE created_at > NOW() - INTERVAL '10 minutes'
    ) = 0
    THEN net.http_post(
      url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/emergency-poll-all-data',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_ANON_KEY'
      ),
      body := '{}'::jsonb
    )
    ELSE NULL
  END;
  $$
);
```

**Success Criteria:**
- ✅ Health dashboard shows real-time status
- ✅ Slack alerts for critical issues
- ✅ Automatic failover if webhooks fail
- ✅ <1-minute detection of issues

---

### Phase 4: Optimization & Polish (Week 4)

#### Day 1-3: Performance Optimization
- [ ] Add database indexes for slow queries
- [ ] Optimize webhook handler (reduce latency to <100ms)
- [ ] Implement connection pooling for polling
- [ ] Add request batching for bulk operations

#### Day 4-5: Frontend Real-time Subscriptions
- [ ] Update all dashboards to use Supabase Realtime
- [ ] Remove manual refresh buttons (optional keep for force refresh)
- [ ] Add "Live" indicator when real-time connected
- [ ] Test with multiple concurrent users

#### Day 6-7: Documentation & Handoff
- [ ] Document all Edge Functions
- [ ] Create runbook for common issues
- [ ] Record Loom walkthrough of architecture
- [ ] Train team on monitoring dashboard

---

## Success Metrics (UPDATED)

### Data Freshness

| Data Type | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Interested Leads | <2s ✅ | <5s ✅ | Already real-time |
| Email Sent Count | 3 hours ❌ | <5s ✅ | **2,160x faster** |
| Reply Count | 3 hours ❌ | <5s ✅ | **2,160x faster** |
| Bounce/Unsub | 3 hours ❌ | <5s ✅ | **2,160x faster** |
| **Email Accounts** | **Manual ❌** | **<5 min ✅** | **Auto-refresh** |
| **Provider Performance** | **Manual ❌** | **<5 min ✅** | **Auto-refresh** |
| **Account Status** | **Manual ❌** | **<30s ✅** | **Real-time alerts** |

### System Health

| Metric | Target | Monitoring |
|--------|--------|------------|
| Webhook Success Rate | >95% | Dashboard + Alerts |
| Data Sync Lag | <5 min | Automated checks |
| Account Disconnect Rate | <5% | Alert if exceeded |
| Provider Reply Rate Drop | <20% | Weekly trend analysis |
| System Uptime | >99.9% | External monitoring |

### User Experience

| Metric | Before | After |
|--------|--------|-------|
| Dashboard Load Time | 2-3s | <1s (cached) |
| Data Freshness Indicator | None | Real-time "Live" badge |
| Manual Refresh Needed | Yes, every page | No, auto-updates |
| Infrastructure Page Load | 30-60s | <2s (cached) |

---

## Risk Mitigation

### Risk 1: Webhook Delivery Failures
**Mitigation:**
- 5-minute polling failsafe
- Webhook retry logic (Email Bison handles)
- Manual emergency sync button
- Slack alerts within 1 minute

### Risk 2: Database Performance Degradation
**Mitigation:**
- Comprehensive indexes on all query patterns
- Connection pooling (max 10 concurrent)
- Query timeout limits (30s)
- Regular VACUUM ANALYZE

### Risk 3: Email Bison API Rate Limits
**Mitigation:**
- Respect rate limits (documented in API)
- Exponential backoff on 429 errors
- Distribute polling across 5-minute window
- Cache aggressively (5-min TTL)

### Risk 4: Missing Email Account Updates
**Mitigation:**
- Subscribe to account webhooks
- 5-minute polling for bulk refresh
- Last-synced timestamp tracking
- Alert if sync lag exceeds 10 minutes

---

## Conclusion

This plan provides a **comprehensive, production-ready architecture** for real-time data synchronization that includes:

✅ **All 6 data categories tracked** (KPIs, Leads, Email Accounts, Campaigns, Metadata, Config)
✅ **Per-account performance metrics** (sends, replies, reply rates by account)
✅ **Provider performance analysis** (Gmail vs Outlook trending)
✅ **8 webhook events** (5 KPI + 3 infrastructure)
✅ **Intelligent polling failsafe** (5-min intervals)
✅ **Smart caching** (60s TTL with prefetch)
✅ **Real-time frontend** (Supabase Realtime subscriptions)
✅ **Self-healing monitoring** (alerts, failover, health checks)

**Estimated Timeline:** 4 weeks for full implementation
**Estimated Cost:** $0 additional (within Supabase free tier)
**Maintenance:** <2 hours/week after initial setup

Ready to begin Phase 1 implementation.
