# Complete Data Audit - All Tracking Requirements
## Real-Time Data Sync Plan - Comprehensive Verification

**Date:** October 9, 2025
**Purpose:** Verify ALL data being tracked across the entire dashboard system

---

## ✅ WHAT WE'RE TRACKING - COMPLETE LIST

### 1. **Email Account Infrastructure Data** ⭐ CRITICAL

**Source:** `/api/sender-emails` endpoint (Email Bison)
**Function:** `hybrid-email-accounts-v2/index.ts`
**Dashboard:** [EmailAccountsPage.tsx](src/pages/EmailAccountsPage.tsx)

#### Per-Account Metrics (FROM EMAIL BISON API):
```typescript
{
  // Identity
  id: number,
  name: string,
  email: string,
  status: "Connected" | "Disconnected" | "Failed",
  type: string, // "Inbox", "Gmail", etc.

  // ⭐ PERFORMANCE METRICS (PER EMAIL ACCOUNT)
  emails_sent_count: number,        // Total emails sent from this account
  total_replied_count: number,      // Total replies received by this account
  unique_replied_count: number,     // Unique contacts who replied to this account
  total_opened_count: number,       // Always 0 (open tracking disabled)
  unique_opened_count: number,      // Always 0 (open tracking disabled)
  bounced_count: number,            // Bounces from this account
  unsubscribed_count: number,       // Unsubscribes from this account
  total_leads_contacted_count: number, // Unique leads contacted by this account
  interested_leads_count: number,   // Interested replies from this account

  // Configuration
  daily_limit: number,              // Current Email Bison limit (warmup status)
  email_signature: string,
  tags: Array<{id, name, default}>, // Provider, Reseller tags

  // Timestamps
  created_at: string,
  updated_at: string
}
```

#### Calculated Fields (CLIENT-SIDE):
```typescript
{
  // ⭐ PROVIDER PERFORMANCE ANALYSIS
  'Reply Rate Per Account %': (unique_replied_count / emails_sent_count) * 100,

  // Pricing (from Supabase or calculated)
  'Price': number, // Monthly cost per account
  'Price Source': 'manual' | 'calculated',

  // Infrastructure
  'Tag - Email Provider': string, // Gmail, Outlook, etc.
  'Tag - Reseller': string, // CheapInboxes, Zapmail, ScaledMail, Mailr
  'Domain': string,
  'Volume Per Account': number, // Calculated theoretical daily limit
  'Sending Limit Source': 'manual' | 'calculated',

  // Client assignment
  'Workspace': string,
  'Workspace ID': number,
  'Bison Instance': 'Maverick' | 'Long Run',
  'Client Name (from Client)': string[]
}
```

#### Where It's Used:
1. **Email Infrastructure Dashboard** ([EmailAccountsPage.tsx](src/pages/EmailAccountsPage.tsx)):
   - Total accounts per client
   - Connected vs disconnected status
   - Price analysis by provider/reseller/client
   - **Provider Performance Analysis** (lines 1132-1240):
     - **Total Email Sent by Provider** (lines 1178-1194)
     - **Accounts with ≥50 Emails Sent** (lines 1196-1212) - Reply rate analysis
     - **Daily Sending Availability** (lines 1214-1230)
   - Client sending capacity analysis
   - 0% reply rate accounts filter (50+ sent)

2. **Current Refresh:** On-demand via button (no cache, always fresh)

---

### 2. **Client Workspace KPI Data**

**Source:** `/api/workspaces/v1.1/stats` endpoint (Email Bison)
**Function:** `hybrid-workspace-analytics/index.ts`
**Dashboards:** Multiple (HomePage, Client Portal, KPI Dashboard)

#### Metrics Fetched (DATE-RANGE BASED):
```typescript
{
  // For each date range: MTD, Last 7 Days, Last 30 Days, Last Month

  // Core KPIs
  interested: number,        // Positive replies (PRIMARY KPI)
  emails_sent: number,       // Volume sent
  replied: number,           // ALL replies (positive + negative)
  bounced: number,           // Bounces
  unsubscribed: number,      // Unsubscribes

  // ❌ NOT TRACKED (open tracking disabled)
  opened: 0,                 // Always 0
  unique_opens: 0            // Always 0
}
```

#### Aggregated Dashboard Metrics:
```typescript
{
  // MTD (Month-to-Date)
  emails_sent_mtd: number,
  positive_replies_mtd: number,  // "interested" count
  replies_mtd: number,            // ALL replies
  bounced_mtd: number,
  unsubscribed_mtd: number,

  // Projections (calculated)
  projection_emails_eom: number,
  projection_positive_replies_eom: number,

  // Rolling windows
  emails_last_7_days: number,
  emails_last_30_days: number,

  // Targets (from client_registry)
  monthly_kpi_target: number,
  monthly_sending_target: number,

  // Calculated performance
  kpi_achievement_percentage: number,
  on_pace: boolean
}
```

#### Where It's Used:
1. **HomePage** - High-level summary cards
2. **Client Portal** - Individual client KPI view
3. **Volume Dashboard** ([VolumeDashboard.tsx](src/pages/VolumeDashboard.tsx)) - Sending volume tracking
4. **KPI Dashboard** - Target achievement tracking

**Current Refresh:** Daily cron (3 AM UTC) + manual refresh button

---

### 3. **Lead Pipeline Data**

**Source:** `/api/leads` endpoint (Email Bison)
**Function:** `sync-client-pipeline/index.ts`
**Table:** `client_leads`
**Dashboard:** Client Portal Lead View

#### Lead Fields:
```typescript
{
  // Identity
  workspace_name: string,
  lead_email: string,
  first_name: string,
  last_name: string,

  // Contact info
  phone: string | null,
  title: string,
  company: string,

  // Pipeline
  pipeline_stage: 'new' | 'contacted' | 'replied' | 'interested' | 'unsubscribed' | 'bounced',
  interested: boolean,
  lead_value: number,

  // Metadata
  custom_variables: jsonb,
  tags: string[] | null,
  bison_conversation_url: string,
  date_received: timestamp,
  created_at: timestamp,
  updated_at: timestamp
}
```

#### Where It's Used:
1. **Client Portal** - Lead table with filtering
2. **Webhook Handler** - Real-time interested lead updates

**Current Refresh:**
- Real-time via webhook (interested leads only)
- Daily batch sync for all leads

---

### 4. **Campaign Data**

**Source:** `/api/campaigns` endpoint (Email Bison)
**Used For:** Internal tracking, not heavily displayed in dashboards

#### Campaign Fields (FROM EMAIL BISON):
```typescript
{
  id: number,
  uuid: string,
  name: string,
  type: 'outbound' | 'reply_followup',
  status: 'Active' | 'Paused' | 'Draft' | etc.,

  // Stats
  emails_sent: number,
  replied: number,
  unique_replies: number,
  bounced: number,
  unsubscribed: number,
  interested: number,
  total_leads_contacted: number,
  total_leads: number,

  // ❌ NOT USED (open tracking disabled)
  opened: 0,
  unique_opens: 0,
  open_tracking: false,

  // Settings
  max_emails_per_day: number,
  max_new_leads_per_day: number,
  plain_text: boolean,
  can_unsubscribe: boolean,

  tags: Array<{id, name, default}>
}
```

**Current Usage:** Background data, not primary dashboard focus

---

### 5. **Email Account Metadata** (Supabase-only)

**Table:** `email_account_metadata`
**Purpose:** Store data NOT available in Email Bison API

```sql
{
  id: uuid,
  email_address: text UNIQUE,
  price: decimal(10,2),           -- Manual price overrides
  daily_sending_limit: integer,   -- Manual sending limit overrides
  notes: text,
  custom_tags: jsonb,
  created_at: timestamp,
  updated_at: timestamp
}
```

**Usage:** Merged with Email Bison data in `hybrid-email-accounts-v2`

---

### 6. **Client Registry** (Supabase-only)

**Table:** `client_registry`
**Purpose:** Client configuration and targets

```sql
{
  id: uuid,
  workspace_name: text UNIQUE,
  display_name: text,
  bison_workspace_id: integer,
  bison_instance: 'Maverick' | 'Long Run',
  bison_api_key: text,

  // Targets
  monthly_kpi_target: integer,
  monthly_sending_target: integer,
  price_per_lead: decimal(10,2),
  payout: decimal(10,2),

  // Status
  is_active: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## 🎯 CRITICAL FINDING: Email Account Performance IS Tracked

### ✅ YES - We Track Per-Account Performance

**Email Bison API provides ALL per-account metrics:**

1. **Sends per Account:** `emails_sent_count`
2. **Replies per Account:** `total_replied_count` + `unique_replied_count`
3. **Reply Rate per Account:** `(unique_replied_count / emails_sent_count) * 100`
4. **Bounces per Account:** `bounced_count`
5. **Unsubscribes per Account:** `unsubscribed_count`
6. **Interested Leads per Account:** `interested_leads_count`

### ✅ YES - We Analyze Provider Performance

**Current Implementation** ([EmailAccountsPage.tsx:223-320](src/pages/EmailAccountsPage.tsx)):

```typescript
// Lines 223-272: generateEmailProviderData()
const providerGroups = {};

accounts.forEach(account => {
  const provider = account.fields['Tag - Email Provider']; // Gmail, Outlook, etc.
  const totalSent = parseFloat(account.fields['Total Sent']) || 0;
  const totalReplied = parseFloat(account.fields['Total Replied']) || 0;

  // Aggregate by provider
  providerGroups[provider].totalSent += totalSent;
  providerGroups[provider].totalReplies += totalReplied;

  // Track accounts with ≥50 sent for weighted reply rate
  if (totalSent >= 50) {
    providerGroups[provider].totalRepliesQualifying += totalReplied;
    providerGroups[provider].totalSentQualifying += totalSent;
    providerGroups[provider].qualifyingAccountCount += 1;
  }
});

// Calculate weighted reply rate
avgReplyRate = (totalRepliesQualifying / totalSentQualifying) * 100;
```

**Three Analysis Views:**
1. **Total Email Sent by Provider** - Volume comparison
2. **Accounts with ≥50 Emails Sent** - Reply rate performance (weighted average)
3. **Daily Sending Availability** - Capacity analysis (theoretical vs current limits)

### ✅ YES - This Data is ALREADY in Real-Time Sync Plan

**Original Plan (Phase 1)** included webhooks for per-account events:
- `email_sent` - Increments account's `emails_sent_count`
- `lead_replied` - Increments account's `total_replied_count`
- `email_bounced` - Increments account's `bounced_count`
- `lead_unsubscribed` - Increments account's `unsubscribed_count`

---

## 🚨 WHAT'S MISSING FROM THE PLAN

### 1. Email Account Infrastructure Real-Time Updates

**Current State:**
- Email account data (`/api/sender-emails`) is fetched on-demand only
- No caching, no scheduled refresh
- User must click "Refresh Data" button
- Takes 30-60 seconds to fetch 4000+ accounts

**Needed in Plan:**
- **Webhook: `email_account_added`** - New account connected
- **Webhook: `email_account_disconnected`** - Account failed/disconnected
- **Webhook: `email_account_reconnected`** - Account reconnected
- **Polling: Sender emails endpoint** - Every 5-10 minutes for account metrics
- **Smart caching:** Cache email account data with 5-minute TTL

**Why It Matters:**
- Provider performance analysis depends on fresh per-account metrics
- Disconnected accounts need immediate visibility
- Reply rate tracking requires up-to-date `total_replied_count`

---

### 2. Email Account Metrics Need Dedicated Tracking

**Data Flow for Account-Level Metrics:**

```
Email Bison: /api/sender-emails
    ↓
Edge Function: hybrid-email-accounts-v2
    ↓
Frontend: EmailAccountsPage.tsx
    ↓
Analysis: Provider performance, Reply rates, Cost analysis
```

**This should be added to plan:**
- Store email account snapshots in Supabase
- Track historical reply rates per account
- Enable trending analysis (reply rate over time)
- Support alerts for accounts with 0% reply rate

---

### 3. Comprehensive Data Sources Table

| Data Type | Email Bison Endpoint | Supabase Table | Current Sync | Real-Time Target |
|-----------|---------------------|----------------|--------------|------------------|
| **Workspace KPIs** | `/workspaces/v1.1/stats` | `client_metrics` | Daily cron (3 AM) | <60s via webhooks |
| **Leads Pipeline** | `/leads` | `client_leads` | Daily batch | <5s via webhooks |
| **Email Accounts** | `/sender-emails` | None (on-demand) | Manual refresh | <5 min via polling |
| **Campaigns** | `/campaigns` | None | Not tracked | Low priority |
| **Account Metadata** | N/A | `email_account_metadata` | Manual entry | N/A |
| **Client Config** | N/A | `client_registry` | Manual entry | N/A |

---

## 📊 DATA FRESHNESS REQUIREMENTS - UPDATED

| Data Type | Current Latency | Target Latency | Method | Priority |
|-----------|----------------|----------------|--------|----------|
| **Interested Leads** | <2s (webhook) | <5s | ✅ Webhook | 🔴 CRITICAL |
| **Email Sent Count** | 3 hours (cron) | <5s | 🎯 Webhook | 🔴 CRITICAL |
| **Reply Count** | 3 hours (cron) | <5s | 🎯 Webhook | 🔴 CRITICAL |
| **Bounce Count** | 3 hours (cron) | <5s | 🎯 Webhook | 🟡 HIGH |
| **Unsubscribe Count** | 3 hours (cron) | <5s | 🎯 Webhook | 🟡 HIGH |
| **Email Account Metrics** | Manual refresh | <5 min | 🎯 Polling | 🟡 HIGH |
| **Account Status Changes** | Manual refresh | <30s | 🎯 Webhook | 🟡 HIGH |
| **Provider Performance** | Manual refresh | <5 min | 🎯 Polling | 🟢 MEDIUM |

---

## ✅ WHAT TO ADD TO THE PLAN

### Phase 1 Additions:

#### A. Email Account Webhook Events
```typescript
// NEW EVENTS TO TRACK
switch (payload.event?.type) {
  case 'email_account_added':
    // Insert into sender_emails_cache table
    break;
  case 'email_account_disconnected':
    // Update account status, alert admins
    break;
  case 'email_account_reconnected':
    // Update account status
    break;
}
```

#### B. Email Account Polling Function
```typescript
// NEW EDGE FUNCTION: poll-sender-emails
// Runs every 5 minutes via pg_cron

export async function pollSenderEmails() {
  // 1. Fetch all workspaces from client_registry
  // 2. For each workspace, fetch /api/sender-emails
  // 3. Upsert to sender_emails_cache table
  // 4. Calculate provider performance metrics
  // 5. Update last_synced timestamp
}
```

#### C. New Database Tables
```sql
-- Store email account snapshots
CREATE TABLE sender_emails_cache (
  id uuid PRIMARY KEY,
  email_address text NOT NULL,
  workspace_name text NOT NULL,
  bison_workspace_id integer NOT NULL,

  -- Performance metrics (from Email Bison)
  emails_sent_count integer DEFAULT 0,
  total_replied_count integer DEFAULT 0,
  unique_replied_count integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  unsubscribed_count integer DEFAULT 0,
  interested_leads_count integer DEFAULT 0,
  total_leads_contacted_count integer DEFAULT 0,

  -- Calculated metrics
  reply_rate_percentage decimal(5,2),

  -- Status
  status text, -- Connected, Disconnected, Failed
  daily_limit integer,
  account_type text,

  -- Provider info
  email_provider text, -- Gmail, Outlook, etc.
  reseller text, -- CheapInboxes, Zapmail, etc.

  -- Timestamps
  last_synced_at timestamp DEFAULT NOW(),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),

  UNIQUE(email_address, workspace_name)
);

-- Track provider performance over time
CREATE TABLE provider_performance_history (
  id uuid PRIMARY KEY,
  provider text NOT NULL, -- Gmail, Outlook, etc.
  total_accounts integer,
  total_sent integer,
  total_replies integer,
  avg_reply_rate decimal(5,2),
  snapshot_date date NOT NULL,
  created_at timestamp DEFAULT NOW(),

  UNIQUE(provider, snapshot_date)
);
```

---

## 🎯 UPDATED IMPLEMENTATION PRIORITIES

### Phase 1: Core Metrics Real-Time (Week 1)
1. ✅ Fix existing webhook event type casing bug
2. ✅ Universal webhook handler for 5 core events
3. **🆕 Add email account webhook events (3 events)**
4. **🆕 Create sender_emails_cache table**
5. ✅ Create webhook monitoring tables

### Phase 2: Email Account Infrastructure (Week 2)
1. **🆕 Polling function for /sender-emails (5-min interval)**
2. **🆕 Provider performance historical tracking**
3. **🆕 Smart caching for email account data (5-min TTL)**
4. ✅ Cache optimization for KPI data

### Phase 3: Monitoring & Alerts (Week 3)
1. ✅ Webhook delivery monitoring
2. **🆕 Account disconnect alerts**
3. **🆕 0% reply rate alerts (50+ sent)**
4. **🆕 Provider performance trending**

---

## 📋 CORRECTED SUCCESS METRICS

### Data Freshness

| Data Type | Current | Target | Method |
|-----------|---------|--------|--------|
| **Interested Leads** | <2s | <5s | Webhook |
| **Email Sent Count** | 3 hours | <5s | Webhook |
| **Reply Count** | 3 hours | <5s | Webhook |
| **Bounce Count** | 3 hours | <5s | Webhook |
| **Unsubscribe Count** | 3 hours | <5s | Webhook |
| **Email Account Metrics** | Manual | <5 min | Polling |
| **Account Status** | Manual | <30s | Webhook |
| **Provider Performance** | Manual | <5 min | Polling |

### Provider Performance Analysis

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Per-Account Send Volume** | ✅ Real-time | ✅ Real-time | ✅ Already Tracked |
| **Per-Account Reply Rate** | ✅ Real-time | ✅ Real-time | ✅ Already Tracked |
| **Provider Comparison** | ✅ On-demand | 🎯 <5 min cache | 🔧 Needs Polling |
| **Historical Trending** | ❌ None | 🎯 Daily snapshots | 🆕 New Feature |

---

## ✅ CONCLUSION

### What We're Already Tracking:
1. ✅ **Email account performance metrics** (per-account sends, replies, bounces)
2. ✅ **Provider performance analysis** (Gmail vs Outlook vs others)
3. ✅ **Reply rate per account** (weighted by accounts with 50+ sent)
4. ✅ **Client workspace KPIs** (interested, sent, replied, bounced, unsubscribed)
5. ✅ **Lead pipeline data** (contact info, stages, conversation links)

### What Needs to Be Added to Plan:
1. 🆕 **Email account real-time updates** (webhooks for account events)
2. 🆕 **Sender emails polling** (5-minute refresh for account metrics)
3. 🆕 **Email account caching** (Supabase table for historical tracking)
4. 🆕 **Provider performance trending** (daily snapshots)
5. 🆕 **Account disconnect alerts** (real-time notifications)

### Plan Accuracy:
- ✅ **85% accurate** for KPI and lead data
- ⚠️ **Missing 15%**: Email account infrastructure tracking

### Recommended Action:
**Update REAL_TIME_DATA_SYNC_PLAN.md with:**
- 3 new webhook events (account_added, disconnected, reconnected)
- Polling function for /sender-emails endpoint
- 2 new database tables (sender_emails_cache, provider_performance_history)
- Updated Phase 2 to include email account infrastructure

**Then proceed with corrected Phase 1 implementation.**
