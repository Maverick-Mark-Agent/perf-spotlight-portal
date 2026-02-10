# Email Bison → Supabase Data Pipeline Audit

**Last Updated:** October 9, 2025
**Purpose:** Complete audit of all data sources, flows, and sync mechanisms between Email Bison and Supabase

---

## Executive Summary

This document maps every data flow from Email Bison to Supabase, identifying:
- 15 Edge Functions that fetch Email Bison data
- 8 database tables storing Email Bison data
- 22+ frontend components consuming Email Bison data
- 3 primary sync mechanisms (webhooks, cron jobs, on-demand)
- Multiple data freshness gaps requiring attention

**Primary Email Bison Instance:** `https://send.maverickmarketingllc.com/api`

---

## Table of Contents

1. [Data Flow Diagram](#data-flow-diagram)
2. [Email Bison API Endpoints Used](#email-bison-api-endpoints-used)
3. [Edge Functions (Data Fetchers)](#edge-functions-data-fetchers)
4. [Database Tables](#database-tables)
5. [Frontend Components](#frontend-components)
6. [Sync Mechanisms](#sync-mechanisms)
7. [Data Freshness Gaps](#data-freshness-gaps)
8. [Recommendations](#recommendations)

---

## Data Flow Diagram

```mermaid
graph TB
    subgraph "Email Bison API"
        EB[Email Bison<br/>send.maverickmarketingllc.com]
        EP1[/api/workspaces/v1.1]
        EP2[/api/workspaces/v1.1/stats]
        EP3[/api/replies?interested=1]
        EP4[/api/leads]
        EP5[/api/sender-emails]
        EP6[/api/tags]
        EP7[/api/campaigns]
    end

    subgraph "Supabase Edge Functions"
        EF1[hybrid-workspace-analytics]
        EF2[sync-interested-replies]
        EF3[bison-interested-webhook]
        EF4[sync-bison-interested-leads]
        EF5[sync-all-metrics]
        EF6[email-bison-campaigns]
        EF7[hybrid-email-accounts-v2]
        EF8[volume-dashboard-data]
        EF9[sync-new-clients]
        EF10[data-health-monitor]
    end

    subgraph "Supabase Database"
        DB1[(client_leads)]
        DB2[(client_registry)]
        DB3[(client_metrics)]
        DB4[(email_account_metadata)]
        DB5[(campaigns)]
        DB6[(api_health_logs)]
        DB7[(data_cache_metadata)]
        DB8[(data_validation_errors)]
    end

    subgraph "Frontend"
        UI1[KPI Dashboard]
        UI2[Client Portal]
        UI3[Volume Dashboard]
        UI4[Revenue Dashboard]
        UI5[Email Accounts Page]
        UI6[Billing Page]
    end

    subgraph "Sync Mechanisms"
        SYNC1[Real-time Webhooks]
        SYNC2[Daily Cron Jobs]
        SYNC3[On-Demand Manual Sync]
    end

    %% Email Bison to Edge Functions
    EP1 --> EF1
    EP2 --> EF1
    EP2 --> EF5
    EP3 --> EF2
    EP4 --> EF4
    EP5 --> EF7
    EP1 --> EF9
    EP7 --> EF6

    %% Webhooks
    EP3 -.Webhook.-> EF3

    %% Edge Functions to Database
    EF1 --> DB2
    EF1 --> DB3
    EF2 --> DB1
    EF3 --> DB1
    EF4 --> DB1
    EF5 --> DB3
    EF7 --> DB4
    EF6 --> DB5
    EF9 --> DB2
    EF10 --> DB6

    %% Database to Frontend
    DB1 --> UI2
    DB2 --> UI1
    DB2 --> UI3
    DB2 --> UI4
    DB3 --> UI1
    DB3 --> UI3
    DB4 --> UI5
    DB5 --> UI6

    %% Sync Mechanisms
    SYNC1 --> EF3
    SYNC2 --> EF5
    SYNC3 --> EF1
    SYNC3 --> EF2
    SYNC3 --> EF4

    style EB fill:#ff6b6b
    style SYNC1 fill:#51cf66
    style SYNC2 fill:#ffd43b
    style SYNC3 fill:#74c0fc
```

---

## Email Bison API Endpoints Used

### Critical Endpoints

| Endpoint | Purpose | Frequency | Edge Functions Using It |
|----------|---------|-----------|------------------------|
| `GET /api/workspaces/v1.1` | List all workspaces | Every dashboard load | `hybrid-workspace-analytics`, `sync-new-clients`, `sync-all-metrics`, `email-bison-campaigns`, `volume-dashboard-data` |
| `POST /api/workspaces/v1.1/switch-workspace` | Switch workspace context | Before each workspace data fetch | All multi-workspace functions |
| `GET /api/workspaces/v1.1/stats` | Workspace statistics (emails sent, replies, interested, etc.) | Dashboard loads + daily sync | `hybrid-workspace-analytics`, `sync-all-metrics`, `volume-dashboard-data` |
| `GET /api/replies?interested=1` | Fetch interested replies | Manual sync + webhook backup | `sync-interested-replies` |
| `GET /api/leads` | Fetch leads (with tag filters) | Manual sync for specific clients | `sync-bison-interested-leads` |
| `GET /api/sender-emails` | Email account details | Infrastructure page load | `hybrid-email-accounts-v2` |
| `GET /api/tags` | Tag definitions | When syncing interested leads | `sync-bison-interested-leads` |
| `GET /api/campaigns` | Campaign list and stats | Campaign scheduling views | `email-bison-campaigns` |

### Query Parameters Used

**For Stats Endpoint:**
```
?start_date=2025-10-01&end_date=2025-10-09
```

**For Replies Endpoint:**
```
?interested=1&per_page=100&page=1
```

**For Leads Endpoint:**
```
?workspace_id=123&filters[tag_ids][]=456&page=1&per_page=100
```

---

## Edge Functions (Data Fetchers)

### 1. `hybrid-workspace-analytics` (Primary KPI Data Source)

**File:** `/supabase/functions/hybrid-workspace-analytics/index.ts`

**Purpose:** Fetch KPI metrics for all active clients

**Email Bison Endpoints:**
- `GET /api/workspaces/v1.1` - List workspaces
- `POST /api/workspaces/v1.1/switch-workspace` - Switch context
- `GET /api/workspaces/v1.1/stats` - Get MTD, last 7 days, last 30 days, last month stats

**Database Tables Populated:**
- None directly (real-time computation)

**Trigger:**
- On-demand via frontend KPI Dashboard
- Cached for 2 minutes

**Update Frequency:** Real-time (with 2-minute cache)

**Data Returned:**
- `interested` count (primary KPI metric)
- `emails_sent` count
- `bounced` count
- Projections based on daily averages

**Code Location:** Lines 162-199 (parallel stats fetching)

---

### 2. `sync-interested-replies` (Interested Leads Sync)

**File:** `/supabase/functions/sync-interested-replies/index.ts`

**Purpose:** Sync all interested replies for a specific workspace to `client_leads` table

**Email Bison Endpoints:**
- `POST /api/workspaces/v1.1/switch-workspace`
- `GET /api/replies?interested=1&per_page=100&page=X`

**Database Tables Populated:**
- `client_leads` (full replace)

**Trigger:**
- Manual sync via admin tools
- Backup for webhook failures

**Update Frequency:** Manual only

**Data Flow:**
1. Switch to target workspace
2. Fetch ALL interested replies (paginated)
3. DELETE all existing leads for workspace
4. INSERT all fetched replies as new leads

**Data Mapped:**
```typescript
{
  airtable_id: `bison_reply_${reply.id}`,
  workspace_name: workspace_name,
  lead_email: reply.from_email_address,
  first_name: parsed from reply.from_name,
  last_name: parsed from reply.from_name,
  date_received: reply.date_received,
  interested: true,
  pipeline_stage: 'new',
  bison_reply_id: reply.id,
  bison_reply_uuid: reply.uuid,
  bison_lead_id: reply.lead_id
}
```

**Code Location:** Lines 74-201

---

### 3. `bison-interested-webhook` (Real-time Lead Capture)

**File:** `/supabase/functions/bison-interested-webhook/index.ts`

**Purpose:** Receive real-time webhooks when a lead is marked as interested in Email Bison

**Email Bison Integration:**
- Webhook endpoint registered in Email Bison
- Event type: `LEAD_INTERESTED`

**Database Tables Populated:**
- `client_leads` (upsert)

**Trigger:**
- Real-time webhook from Email Bison when lead marked interested

**Update Frequency:** Real-time (< 1 second)

**Webhook Payload:**
```typescript
{
  event: {
    type: 'LEAD_INTERESTED',
    workspace_id: number,
    workspace_name: string,
    instance_url: string
  },
  data: {
    lead: { id, email, first_name, last_name, company, title, custom_variables },
    reply: { id, uuid, date_received, from_email_address },
    campaign: { id, name },
    sender_email: { id, email, name }
  }
}
```

**Data Flow:**
1. Receive webhook POST request
2. Validate event type is `LEAD_INTERESTED`
3. Check if lead already exists (by email + workspace)
4. If exists: UPDATE with new data (preserve pipeline_stage)
5. If new: INSERT with pipeline_stage='interested'

**Webhook URL:** `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook`

**Rollout Status:** Deployed to 24/24 clients (complete as of Oct 8, 2025)

**Code Location:** Lines 47-210

---

### 4. `sync-bison-interested-leads` (Tag-based Sync)

**File:** `/supabase/functions/sync-bison-interested-leads/index.ts`

**Purpose:** Sync leads using "Interested" tag filter (alternative to replies endpoint)

**Email Bison Endpoints:**
- `GET /api/workspaces` - Find workspace ID
- `GET /api/tags?workspace_id=X` - Find "Interested" tag ID
- `GET /api/leads?workspace_id=X&filters[tag_ids][]=Y` - Fetch tagged leads

**Database Tables Populated:**
- `client_leads` (full replace)

**Trigger:**
- Manual sync for specific clients
- Used when reply history incomplete

**Update Frequency:** Manual only

**Data Flow:**
1. Find workspace by name
2. Find "Interested" tag ID in workspace
3. DELETE all existing leads for workspace
4. Fetch ALL leads with "Interested" tag (paginated)
5. INSERT leads with full Email Bison metadata

**Data Included:**
```typescript
{
  // Contact info
  lead_email, first_name, last_name, phone, address, city, state, zip,

  // Professional info
  title, company,

  // Email Bison metadata
  custom_variables, tags, lead_status, lead_campaign_data, overall_stats,

  // Links
  bison_conversation_url,
  bison_lead_id
}
```

**Code Location:** Lines 109-255

---

### 5. `sync-all-metrics` (Daily Metrics Batch Sync)

**File:** `/supabase/functions/sync-all-metrics/index.ts`

**Purpose:** Daily batch sync of metrics for all active clients

**Email Bison Endpoints:**
- `GET /api/workspaces/v1.1`
- `POST /api/workspaces/v1.1/switch-workspace`
- `GET /api/workspaces/v1.1/stats` (MTD, last 7 days, last 30 days)

**Database Tables Populated:**
- `client_metrics` (upsert by workspace_name + metric_date + metric_type)

**Trigger:**
- Daily cron job at 3 AM UTC
- Manual trigger via admin tools

**Update Frequency:** Daily (automated)

**Data Stored:**
```typescript
{
  workspace_name,
  metric_date: CURRENT_DATE,
  metric_type: 'mtd',
  emails_sent_mtd,
  positive_replies_mtd,
  positive_replies_last_7_days,
  positive_replies_last_30_days,
  projection_emails_eom,
  projection_positive_replies_eom,
  mtd_leads_progress,
  projection_replies_progress
}
```

**Cron Schedule:** `0 3 * * *` (3 AM UTC daily)

**Code Location:** Lines 32-233

---

### 6. `email-bison-campaigns` (Campaign Scheduling Data)

**File:** `/supabase/functions/email-bison-campaigns/index.ts`

**Purpose:** Fetch campaign scheduling data for volume projections

**Email Bison Endpoints:**
- `GET /api/workspaces/v1.1`
- `POST /api/workspaces/v1.1/switch-workspace`
- `GET /api/workspaces/v1.1/stats` (for email volume estimation)

**Database Tables Populated:**
- None (returns data directly to frontend)

**Trigger:**
- On-demand from billing/volume pages

**Update Frequency:** Real-time (no cache)

**Data Returned:**
```typescript
{
  schedules: [
    {
      clientName,
      todayEmails: estimated,
      tomorrowEmails: estimated,
      totalScheduled,
      threeDayAverage
    }
  ],
  targetVolumePerDay: median of 3-day averages
}
```

**Note:** Uses email volume as proxy for scheduled emails (actual campaign schedule API not used)

**Code Location:** Lines 50-147

---

### 7. `hybrid-email-accounts-v2` (Email Accounts Infrastructure)

**File:** `/supabase/functions/hybrid-email-accounts-v2/index.ts`

**Purpose:** Fetch email account details for infrastructure monitoring

**Email Bison Endpoints:**
- `GET /api/sender-emails` (paginated)

**Database Tables Populated:**
- `email_account_metadata` (upsert)

**Trigger:**
- On-demand from Email Accounts page
- Cached for 10 minutes

**Update Frequency:** Real-time (with 10-minute cache)

**Data Stored:**
```typescript
{
  workspace_name,
  account_email,
  account_name,
  provider, // Gmail, Outlook, IMAP/SMTP
  is_connected,
  daily_limit,
  warmup_enabled,
  warmup_stage,
  total_sent,
  health_status
}
```

**Code Location:** Multiple functions with similar pattern

---

### 8. `volume-dashboard-data` (Volume Dashboard)

**File:** `/supabase/functions/volume-dashboard-data/index.ts`

**Purpose:** Real-time volume metrics for all clients

**Email Bison Endpoints:**
- `GET /api/workspaces/v1.1`
- `POST /api/workspaces/v1.1/switch-workspace`
- `GET /api/workspaces/v1.1/stats`

**Database Tables Populated:**
- None (real-time computation)

**Trigger:**
- On-demand from Volume Dashboard
- Cached for 2 minutes

**Update Frequency:** Real-time (with 2-minute cache)

**Optimization:** Parallel batch processing (5 workspaces at a time)

**Code Location:** Similar to `hybrid-workspace-analytics`

---

### 9. `sync-new-clients` (Client Registry Sync)

**File:** `/supabase/functions/sync-new-clients/index.ts`

**Purpose:** Discover new workspaces in Email Bison and add to client registry

**Email Bison Endpoints:**
- `GET /api/workspaces/v1.1`

**Database Tables Populated:**
- `client_registry` (insert new clients only)

**Trigger:**
- Manual sync when new clients added to Email Bison

**Update Frequency:** Manual only

**Data Flow:**
1. Fetch all workspaces from Email Bison
2. Check which ones don't exist in `client_registry`
3. INSERT new workspaces with default settings

**Code Location:** Lines in sync-new-clients function

---

### 10. `data-health-monitor` (Health Monitoring)

**File:** `/supabase/functions/data-health-monitor/index.ts`

**Purpose:** Monitor Email Bison API health and data consistency

**Email Bison Endpoints:**
- `GET /api/workspaces` (health check)

**Database Tables Populated:**
- `api_health_logs`
- `data_cache_metadata`
- `data_validation_errors`

**Trigger:**
- Scheduled health checks (planned)
- Manual diagnostics

**Update Frequency:** Planned for 15-minute intervals

**Health Checks:**
1. Email Bison API availability
2. Response time monitoring
3. Cache freshness validation
4. Data validation error tracking

**Code Location:** Lines 41-291

---

### Other Edge Functions

**11. `sync-client-leads`** - Legacy sync function (deprecated in favor of webhook)
**12. `sync-bison-leads`** - Legacy sync function (deprecated)
**13. `scheduled-sync-leads`** - Legacy scheduled sync (deprecated)
**14. `sync-all-interested-leads`** - Batch sync for all workspaces
**15. `sync-all-interested-stats`** - Alternative stats fetching function

---

## Database Tables

### 1. `client_leads` (Primary Leads Storage)

**Purpose:** Store all interested leads from Email Bison

**Schema:**
```sql
CREATE TABLE client_leads (
  id UUID PRIMARY KEY,

  -- Identifiers
  airtable_id TEXT UNIQUE NOT NULL, -- Actually stores bison_reply_id
  workspace_name TEXT NOT NULL,
  bison_reply_id TEXT,
  bison_reply_uuid TEXT,
  bison_lead_id TEXT,

  -- Contact Info
  lead_email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,

  -- Professional Info
  title TEXT,
  company TEXT,

  -- Lead Details
  date_received TIMESTAMP WITH TIME ZONE,
  reply_received TEXT,
  email_subject TEXT,
  lead_value DECIMAL(10,2) DEFAULT 500,
  interested BOOLEAN DEFAULT TRUE,

  -- Email Bison Metadata
  custom_variables JSONB,
  tags JSONB,
  lead_status TEXT,
  lead_campaign_data JSONB,
  overall_stats JSONB,

  -- Pipeline Management
  pipeline_stage TEXT DEFAULT 'new',
  pipeline_position INTEGER DEFAULT 0,
  notes TEXT,

  -- Premium Insurance Fields (specific clients)
  premium_amount DECIMAL(10,2),
  policy_type TEXT,
  renewal_date TEXT,
  birthday TEXT,

  -- URLs
  bison_conversation_url TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE
);
```

**Data Sources:**
- `bison-interested-webhook` (real-time, upsert)
- `sync-interested-replies` (manual, full replace)
- `sync-bison-interested-leads` (manual, full replace)

**Update Frequency:**
- Real-time via webhooks (24/24 clients)
- Manual sync as backup

**Indexes:**
- `idx_client_leads_workspace` ON (workspace_name)
- `idx_client_leads_pipeline` ON (pipeline_stage)
- `idx_client_leads_date` ON (date_received DESC)
- `idx_client_leads_airtable` ON (airtable_id)

**Frontend Consumers:**
- Client Portal Page (primary)
- Client ROI Calculator
- Lead Detail Modal
- State Leads Analytics

**Current Volume:** ~500-1000 leads across all clients

---

### 2. `client_registry` (Master Client List)

**Purpose:** Single source of truth for all active clients

**Schema:**
```sql
CREATE TABLE client_registry (
  workspace_id INTEGER PRIMARY KEY,
  workspace_name TEXT NOT NULL UNIQUE,

  -- Display
  display_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  -- Email Bison Integration
  bison_workspace_id INTEGER,
  bison_instance TEXT DEFAULT 'send.maverickmarketingllc.com',
  bison_api_key TEXT, -- Per-workspace API keys

  -- Billing
  billing_type TEXT CHECK (billing_type IN ('per_lead', 'retainer')),
  price_per_lead DECIMAL(10,2) DEFAULT 0,
  retainer_amount DECIMAL(10,2) DEFAULT 0,
  payout DECIMAL(10,2) DEFAULT 0,

  -- Targets
  monthly_kpi_target INTEGER DEFAULT 0,
  monthly_sending_target INTEGER DEFAULT 0,

  -- Metadata
  airtable_record_id TEXT,
  airtable_workspace_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Data Sources:**
- `sync-new-clients` (discovers new workspaces)
- Manual admin updates for targets and billing

**Update Frequency:**
- New clients: Manual sync when added
- Targets/billing: Manual updates as needed

**Frontend Consumers:**
- All dashboards (for client list and targets)
- KPI Dashboard (for monthly targets)
- Volume Dashboard (for sending targets)
- Revenue Dashboard (for billing calculations)

**Current Volume:** 27 active clients

---

### 3. `client_metrics` (Time-Series Metrics)

**Purpose:** Store daily and monthly metrics snapshots

**Schema:**
```sql
CREATE TABLE client_metrics (
  id UUID PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES client_registry(workspace_name),

  -- Date/Type
  metric_date DATE NOT NULL,
  metric_type TEXT CHECK (metric_type IN ('daily', 'monthly', 'mtd')),

  -- Email Volume
  emails_sent INTEGER DEFAULT 0,
  emails_sent_mtd INTEGER DEFAULT 0,
  projection_emails_eom INTEGER DEFAULT 0,

  -- Replies/Leads
  positive_replies INTEGER DEFAULT 0,
  positive_replies_mtd INTEGER DEFAULT 0,
  positive_replies_last_7_days INTEGER DEFAULT 0,
  positive_replies_last_14_days INTEGER DEFAULT 0,
  positive_replies_last_30_days INTEGER DEFAULT 0,
  positive_replies_current_month INTEGER DEFAULT 0,
  positive_replies_last_month INTEGER DEFAULT 0,
  projection_positive_replies_eom INTEGER DEFAULT 0,

  -- Progress Percentages
  mtd_leads_progress DECIMAL(5,2) DEFAULT 0,
  projection_replies_progress DECIMAL(5,2) DEFAULT 0,
  last_week_vs_week_before_progress DECIMAL(5,2) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_name, metric_date, metric_type)
);
```

**Data Sources:**
- `sync-all-metrics` (daily cron job)

**Update Frequency:**
- Daily at 3 AM UTC

**Frontend Consumers:**
- KPI Dashboard (for historical trends - PLANNED)
- Volume Dashboard (for trend analysis - PLANNED)

**Current Usage:** Limited - mostly used for backup/historical reference

**Note:** Most dashboards fetch real-time data from Email Bison instead of using this table

---

### 4. `email_account_metadata` (Email Account Details)

**Purpose:** Store email account configuration and health status

**Schema:**
```sql
CREATE TABLE email_account_metadata (
  id UUID PRIMARY KEY,
  workspace_name TEXT NOT NULL,

  -- Account Info
  account_email TEXT NOT NULL,
  account_name TEXT,
  provider TEXT, -- 'gmail', 'outlook', 'imap_smtp'

  -- Configuration
  is_connected BOOLEAN DEFAULT TRUE,
  daily_limit INTEGER,
  daily_sending_limit INTEGER,

  -- Warmup
  warmup_enabled BOOLEAN DEFAULT FALSE,
  warmup_stage TEXT,

  -- Stats
  total_sent INTEGER DEFAULT 0,
  health_status TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_name, account_email)
);
```

**Data Sources:**
- `hybrid-email-accounts-v2` (on-demand)

**Update Frequency:**
- Real-time with 10-minute cache

**Frontend Consumers:**
- Email Accounts Page (primary)
- Infrastructure monitoring views

**Current Volume:** ~4000+ email accounts across all workspaces

---

### 5. `campaigns` (Campaign Metadata)

**Purpose:** Store campaign information for scheduling

**Schema:**
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES client_registry(workspace_name),

  -- Campaign Info
  campaign_name TEXT NOT NULL,
  airtable_record_id TEXT UNIQUE,

  -- Scheduling
  emails_scheduled_today INTEGER DEFAULT 0,
  emails_scheduled_tomorrow INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_name, campaign_name)
);
```

**Data Sources:**
- `email-bison-campaigns` (indirectly - estimates only)

**Update Frequency:**
- Rarely updated (mostly legacy Airtable data)

**Frontend Consumers:**
- Billing Page (for campaign scheduling estimates)

**Current Status:** Underutilized - most campaign data fetched real-time

---

### 6. `api_health_logs` (API Monitoring)

**Purpose:** Monitor Email Bison API health and performance

**Schema:**
```sql
CREATE TABLE api_health_logs (
  id UUID PRIMARY KEY,
  api_name TEXT NOT NULL, -- 'Email Bison'
  endpoint TEXT,

  -- Response Info
  status_code INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN,
  error_type TEXT,

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Data Sources:**
- `data-health-monitor`
- All edge functions log their API calls here

**Update Frequency:**
- Every API call

**Usage:**
- Health monitoring
- Performance analysis
- Error trend identification

---

### 7. `data_cache_metadata` (Cache Tracking)

**Purpose:** Track cache freshness for dashboards

**Schema:**
```sql
CREATE TABLE data_cache_metadata (
  cache_key TEXT PRIMARY KEY,
  data_type TEXT, -- 'kpi', 'volume', 'revenue', 'infrastructure'

  -- Status
  status TEXT, -- 'fresh', 'stale', 'error'
  last_updated TIMESTAMP WITH TIME ZONE,
  last_accessed TIMESTAMP WITH TIME ZONE,

  -- Metadata
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Data Sources:**
- Frontend data service layer

**Update Frequency:**
- Every cache read/write

**Usage:**
- Cache health monitoring
- Stale data detection

---

### 8. `data_validation_errors` (Validation Tracking)

**Purpose:** Log data validation failures

**Schema:**
```sql
CREATE TABLE data_validation_errors (
  id UUID PRIMARY KEY,
  source TEXT, -- 'kpi_dashboard', 'volume_dashboard', etc.
  error_type TEXT,
  error_message TEXT,
  severity TEXT, -- 'critical', 'warning', 'info'

  -- Context
  affected_workspace TEXT,
  raw_data JSONB,

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Data Sources:**
- Frontend data validation layer

**Update Frequency:**
- When validation fails

**Usage:**
- Data quality monitoring
- Schema mismatch detection

---

## Frontend Components

### Components Consuming Email Bison Data

| Component | Data Source | Update Frequency | Email Bison Data |
|-----------|-------------|------------------|------------------|
| **KPI Dashboard** | `hybrid-workspace-analytics` | 2-min cache | Interested counts, email stats, projections |
| **ClientKPIStats** | `hybrid-workspace-analytics` | 2-min cache | Individual client metrics |
| **Volume Dashboard** | `volume-dashboard-data` | 2-min cache | Sending volume, targets, projections |
| **Client Portal Page** | `client_leads` table | Real-time (webhooks) | Lead details, pipeline stages |
| **LeadDetailModal** | `client_leads` table | Real-time | Full lead information including custom variables |
| **ClientROICalculator** | `client_leads` table | Real-time | Lead counts for ROI calculations |
| **Email Accounts Page** | `hybrid-email-accounts-v2` | 10-min cache | Account status, limits, health |
| **Billing Page** | `email-bison-campaigns` | No cache | Campaign scheduling estimates |
| **Revenue Dashboard** | `revenue-analytics` + `client_leads` | 5-min cache | Lead counts for revenue calculations |
| **Client Portal Hub** | `client_leads` table | Real-time | Lead counts per client |
| **State Leads Analytics** | `client_leads` table | Real-time | Geographic lead distribution |
| **Zip Dashboard** | `client_leads` table | Real-time | Zip code lead distribution |
| **Contact Pipeline Dashboard** | `client_leads` table | Real-time | Pipeline stage analytics |
| **Client Management** | `client_registry` + `client_leads` | Real-time | Client list and lead counts |
| **Client Profile** | `client_registry` + `client_leads` | Real-time | Full client metrics |
| **KPI Test Page** | `email-bison-kpi-test` | No cache | Airtable vs Email Bison comparison |
| **Dashboard Context** | Multiple sources | Varies | Unified state management |
| **Data Freshness Indicator** | Cache metadata | Real-time | Shows data age and staleness |
| **PremiumInputDialog** | `client_leads` table | Real-time | Premium insurance fields |
| **Zip Choropleth Map** | `client_leads` table | Real-time | Geographic visualization |
| **Add Agency Modal** | `client_registry` | Manual | New client creation |
| **Bulk Zip Assignment Modal** | `client_leads` table | Real-time | Lead assignment to agents |

### Data Flow Pattern

```
1. Frontend Component Loads
   ↓
2. DashboardContext checks cache
   ↓
3. If cached & fresh → Return immediately
   ↓
4. If stale → Fetch from Edge Function
   ↓
5. Edge Function fetches from Email Bison
   ↓
6. Data validated via Zod schemas
   ↓
7. Cache updated
   ↓
8. Component renders with validated data
```

---

## Sync Mechanisms

### 1. Real-time Webhooks (PRIMARY)

**Status:** ✅ Complete - Deployed to 24/24 clients

**How It Works:**
1. User marks reply as "Interested" in Email Bison
2. Email Bison sends webhook to: `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook`
3. Webhook function receives payload
4. Lead upserted to `client_leads` table
5. Frontend sees new lead in real-time (via Supabase real-time subscriptions if enabled)

**Latency:** < 2 seconds from Email Bison to Supabase

**Event Type:** `LEAD_INTERESTED`

**Webhook Configuration (per workspace):**
```json
{
  "name": "Supabase Production Webhook",
  "url": "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook",
  "events": ["lead_interested"]
}
```

**Rollout Timeline:**
- Phase 1: 3 test clients (Oct 6)
- Phase 2: 8 additional clients (Oct 7)
- Phase 3: Remaining 13 clients (Oct 8)
- **Status:** Complete

**Monitoring:**
- Daily health check function: `daily-webhook-health-check`
- Logs to: `webhook_health_logs` table (if exists)
- Alerts: Slack notifications for failures (planned)

**Verification Script:**
```bash
./scripts/verify-all-webhooks.sh
```

---

### 2. Daily Cron Jobs (BACKUP)

**Status:** ✅ Active

**Cron Job:** `sync-all-metrics-daily`

**Schedule:** `0 3 * * *` (3 AM UTC daily)

**Edge Function:** `sync-all-metrics`

**Purpose:**
- Backup sync for metrics
- Populate `client_metrics` table for historical trends
- Ensure data consistency if webhooks fail

**What It Syncs:**
- MTD emails sent
- MTD positive replies
- Last 7/30 days stats
- Projections

**SQL Configuration:**
```sql
-- supabase/migrations/20251007000000_setup_daily_sync_cron.sql
SELECT cron.schedule(
  'sync-all-metrics-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-all-metrics',
    headers := jsonb_build_object('Authorization', 'Bearer ...'),
    body := '{}'::jsonb
  );
  $$
);
```

**Monitoring:**
```sql
SELECT * FROM cron.job WHERE jobname = 'sync-all-metrics-daily';
SELECT * FROM cron.job_run_details WHERE jobname = 'sync-all-metrics-daily' ORDER BY start_time DESC LIMIT 10;
```

---

### 3. On-Demand Manual Sync (FALLBACK)

**Status:** ✅ Available

**Trigger:** Admin manual action via Supabase Dashboard or scripts

**Available Functions:**
- `sync-interested-replies` - Sync all interested replies for one workspace
- `sync-bison-interested-leads` - Sync via "Interested" tag filter
- `sync-all-interested-leads` - Batch sync all workspaces
- `sync-new-clients` - Discover new clients in Email Bison

**When To Use:**
- Webhook delivery failures
- Initial client setup
- Backfilling historical data
- Debugging data inconsistencies

**Example:**
```bash
# Sync specific workspace
curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-interested-replies \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workspace_name": "David Amiri"}'
```

---

### 4. Frontend Cache Refresh (USER-INITIATED)

**Status:** ✅ Active

**How It Works:**
- User clicks "Refresh Data" button in dashboard
- Frontend calls edge function with cache bypass
- New data fetched from Email Bison
- Cache updated with 2-10 minute TTL

**Cache TTLs:**
- KPI Data: 2 minutes
- Volume Data: 2 minutes
- Revenue Data: 5 minutes
- Infrastructure Data: 10 minutes

**Cache Implementation:**
```typescript
// src/services/dataService.ts
const CACHE_TTL = {
  KPI: 2 * 60 * 1000,           // 2 minutes
  VOLUME: 2 * 60 * 1000,         // 2 minutes
  REVENUE: 5 * 60 * 1000,        // 5 minutes
  INFRASTRUCTURE: 10 * 60 * 1000, // 10 minutes
};
```

---

## Data Freshness Gaps

### Critical Gaps

| Data Type | Current State | Ideal State | Impact | Priority |
|-----------|---------------|-------------|--------|----------|
| **Interested Leads** | Real-time webhooks (< 2s) | ✅ Optimal | None | ✅ Complete |
| **Campaign Stats** | 2-min cache | 1-min cache or real-time | Medium - dashboards show slightly stale data | 🟡 Medium |
| **Email Account Health** | 10-min cache | 5-min cache | Low - infrastructure changes slowly | 🟢 Low |
| **Historical Metrics** | Daily at 3 AM | Hourly updates | Medium - trend analysis delayed | 🟡 Medium |
| **Revenue Calculations** | 5-min cache (relies on real-time leads) | ✅ Adequate | None | ✅ Complete |
| **Email Volume Today** | 2-min cache | Real-time streaming | High - volume monitoring critical | 🔴 High |
| **Campaign Scheduling** | No cache (always fresh) | ✅ Optimal | None | ✅ Complete |

---

### Identified Stale Data Scenarios

#### 1. Dashboard Load During High Traffic
**Problem:** If 5 users load KPI dashboard simultaneously, first user triggers API call, others wait up to 45 seconds

**Current Mitigation:** Request deduplication - all users share same promise

**Improvement Needed:** Background cache refresh before expiration

**Priority:** 🟡 Medium

---

#### 2. Campaign Stats After Midnight UTC
**Problem:** Daily metrics sync runs at 3 AM UTC. Data for previous day incomplete until then.

**Impact:** Dashboards show partial data between midnight-3AM UTC

**Current Mitigation:** None

**Improvement Needed:** End-of-day sync at 11:59 PM UTC

**Priority:** 🟡 Medium

---

#### 3. Webhook Delivery Failures
**Problem:** If Email Bison webhook fails to deliver, lead not synced until manual refresh

**Current Mitigation:**
- Retry logic in Email Bison (3 attempts)
- Daily health check monitors webhook status
- Manual sync functions available

**Improvement Needed:**
- Automatic fallback to polling if webhook silent for 1+ hour
- Slack alerts for webhook failures

**Priority:** 🔴 High

---

#### 4. New Client Onboarding
**Problem:** New workspace added to Email Bison not automatically discovered

**Current State:** Manual sync required via `sync-new-clients`

**Impact:** New clients not visible in dashboards until manual sync

**Improvement Needed:** Daily scan for new workspaces in Email Bison

**Priority:** 🟢 Low (rare occurrence)

---

#### 5. Email Bison API Rate Limiting
**Problem:** During batch fetching (27 workspaces), API rate limits may slow or block requests

**Current Mitigation:**
- Batch size of 5 concurrent requests
- Sequential processing after batches

**Observed:** No rate limiting issues yet

**Improvement Needed:** Implement exponential backoff on 429 errors

**Priority:** 🟢 Low (preventative)

---

#### 6. Client Target Changes
**Problem:** If client's monthly KPI target changes in Email Bison, not reflected in Supabase

**Current State:** Targets stored in `client_registry`, manually updated

**Impact:** Progress percentages incorrect until manual update

**Improvement Needed:** Sync targets from Email Bison workspace settings (if available via API)

**Priority:** 🟡 Medium

---

#### 7. Historical Data Backfill
**Problem:** No historical data in Supabase for dates before Oct 2025

**Current State:** `client_metrics` table only has data since Oct 2025

**Impact:** Cannot show month-over-month trends for older data

**Improvement Needed:** Backfill script to fetch historical stats from Email Bison

**Priority:** 🟢 Low (nice-to-have for analytics)

---

### Data Consistency Issues

#### 1. Interested Count Mismatch
**Scenario:** Email Bison shows 50 interested leads, `client_leads` table shows 48

**Possible Causes:**
- Webhook delivery failure
- Lead unmarked as interested in Email Bison (not synced to Supabase)
- Manual deletion in Supabase

**Detection:** Compare `client_leads` count vs Email Bison stats endpoint

**Resolution:** Run `sync-interested-replies` for workspace

---

#### 2. Duplicate Leads
**Scenario:** Same lead appears twice in `client_leads` table

**Possible Causes:**
- Race condition between webhook and manual sync
- Email changed in Email Bison after initial sync

**Prevention:** UNIQUE constraint on `airtable_id` (bison_reply_id)

**Resolution:** Delete duplicates manually

---

#### 3. Stale Pipeline Stages
**Scenario:** Lead moved to "Won" in client portal, but re-synced from Email Bison resets to "Interested"

**Possible Causes:**
- Full replace sync (DELETE + INSERT) overwrites local changes
- Webhook upsert preserves pipeline_stage, but manual sync doesn't

**Current Mitigation:** Webhook upsert preserves `pipeline_stage` if lead exists

**Improvement Needed:** Manual sync should also preserve pipeline stages

**Priority:** 🔴 High (affects client workflow)

---

## Recommendations

### Immediate Actions (High Priority)

#### 1. Fix Manual Sync to Preserve Pipeline Stages
**Issue:** `sync-interested-replies` and `sync-bison-interested-leads` do full DELETE+INSERT, losing pipeline stages

**Solution:**
```typescript
// Instead of DELETE all + INSERT all
// Do: UPSERT with pipeline_stage preservation

const { error } = await supabase
  .from('client_leads')
  .upsert(leads, {
    onConflict: 'airtable_id',
    ignoreDuplicates: false
  });

// In SQL:
// ON CONFLICT (airtable_id) DO UPDATE SET
//   ... all fields except pipeline_stage, pipeline_position, notes
```

**Files to Update:**
- `/supabase/functions/sync-interested-replies/index.ts` (lines 142-170)
- `/supabase/functions/sync-bison-interested-leads/index.ts` (lines 75-85, 206-220)

---

#### 2. Implement Webhook Failure Alerts
**Issue:** No automated alerts when webhooks stop delivering

**Solution:**
- Enhance `daily-webhook-health-check` to send Slack alerts
- Alert if workspace has 0 webhook deliveries in last 24 hours
- Alert if webhook returns 4xx/5xx errors

**Implementation:**
```typescript
// In daily-webhook-health-check function
if (workspaceStats.webhook_deliveries_24h === 0) {
  await sendSlackAlert({
    workspace: workspace.name,
    alert: 'No webhook deliveries in 24 hours',
    severity: 'high'
  });
}
```

---

#### 3. Add Automatic Fallback Polling
**Issue:** If webhooks fail silently, data goes stale

**Solution:**
- If workspace has 0 webhook deliveries in 2+ hours, trigger manual sync
- Schedule fallback sync cron job every 2 hours
- Log when fallback is used

**Implementation:**
```sql
-- New cron job: fallback-sync-check
SELECT cron.schedule(
  'fallback-sync-check',
  '0 */2 * * *', -- Every 2 hours
  $$
  SELECT net.http_post(
    url := 'https://.../functions/v1/check-and-sync-stale-workspaces'
  );
  $$
);
```

---

### Short-term Improvements (Medium Priority)

#### 4. Reduce Dashboard Cache TTL
**Current:** 2 minutes for KPI/Volume
**Proposed:** 1 minute for KPI/Volume

**Rationale:** Faster data refresh for critical dashboards

**Trade-off:** Slightly more API calls to Email Bison

---

#### 5. Implement Background Cache Refresh
**Issue:** When cache expires, user waits for full API call

**Solution:** Refresh cache in background 30 seconds before expiration

**Implementation:**
```typescript
// In dataService.ts
const age = Date.now() - cached.timestamp;
const timeUntilExpiry = ttl - age;

if (timeUntilExpiry < 30000 && !isPrefetching) {
  // Start background refresh
  prefetchData(key).catch(console.error);
}

// Return slightly stale cache immediately
return cached;
```

---

#### 6. Add End-of-Day Metrics Sync
**Current:** Daily sync at 3 AM UTC
**Proposed:** Add 11:59 PM UTC sync for previous day completion

**Rationale:** Ensures full-day metrics available immediately at midnight

---

#### 7. Sync Client Targets from Email Bison
**Issue:** Targets manually maintained in `client_registry`

**Solution:** Fetch targets from Email Bison if available via API

**Research Needed:** Check if Email Bison API exposes workspace-level KPI targets

---

### Long-term Enhancements (Low Priority)

#### 8. Real-time Dashboard Streaming
**Proposed:** Replace polling with WebSocket streaming from Email Bison

**Benefits:** True real-time updates without API polling

**Complexity:** High - requires Email Bison WebSocket support

---

#### 9. Historical Data Backfill
**Proposed:** Fetch stats from Email Bison for Jan-Sep 2025

**Benefits:** Full year-over-year trend analysis

**Complexity:** Medium - batch API calls with rate limiting

---

#### 10. Multi-Instance Support
**Current:** All clients on `send.maverickmarketingllc.com`
**Future:** Support clients on different Email Bison instances

**Implementation:** Add `bison_instance` field to `client_registry`, use per-client API base URL

---

#### 11. Unified Sync Status Dashboard
**Proposed:** Admin dashboard showing sync status for all workspaces

**Features:**
- Last webhook delivery time
- Last manual sync time
- Data freshness indicators
- Error logs
- One-click manual sync buttons

**Benefits:** Single pane of glass for data pipeline health

---

## Appendix A: Email Bison API Rate Limits

**Observed Limits:**
- No documented rate limits
- 100 concurrent requests tested successfully
- Batch size of 5 used conservatively

**Best Practices:**
- Use pagination for large result sets
- Implement exponential backoff on errors
- Cache responses where possible

---

## Appendix B: Webhook Payload Examples

### LEAD_INTERESTED Webhook

```json
{
  "event": {
    "type": "LEAD_INTERESTED",
    "name": "Lead Interested",
    "instance_url": "https://send.maverickmarketingllc.com",
    "workspace_id": 123,
    "workspace_name": "David Amiri"
  },
  "data": {
    "lead": {
      "id": 45678,
      "email": "john.doe@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "status": "active",
      "title": "Director of Marketing",
      "company": "Acme Corp",
      "custom_variables": [
        {"name": "phone", "value": "555-1234"},
        {"name": "industry", "value": "SaaS"}
      ]
    },
    "reply": {
      "id": 98765,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "date_received": "2025-10-09T14:32:00Z",
      "from_name": "John Doe",
      "from_email_address": "john.doe@example.com"
    },
    "campaign": {
      "id": 111,
      "name": "Q4 Outreach Campaign"
    },
    "sender_email": {
      "id": 222,
      "email": "sales@davidamiri.com",
      "name": "David Amiri"
    }
  }
}
```

---

## Appendix C: SQL Queries for Monitoring

### Check Data Freshness
```sql
-- Show last sync time for each workspace
SELECT
  workspace_name,
  MAX(last_synced_at) as last_sync,
  AGE(NOW(), MAX(last_synced_at)) as age
FROM client_leads
GROUP BY workspace_name
ORDER BY last_sync DESC;
```

### Compare Lead Counts
```sql
-- Compare Supabase count vs Email Bison stats
WITH supabase_counts AS (
  SELECT workspace_name, COUNT(*) as supabase_count
  FROM client_leads
  WHERE interested = true
  GROUP BY workspace_name
),
bison_counts AS (
  SELECT workspace_name, positive_replies_mtd as bison_count
  FROM client_metrics
  WHERE metric_type = 'mtd'
  AND metric_date = CURRENT_DATE
)
SELECT
  s.workspace_name,
  s.supabase_count,
  b.bison_count,
  (s.supabase_count - b.bison_count) as difference
FROM supabase_counts s
LEFT JOIN bison_counts b ON s.workspace_name = b.workspace_name
WHERE ABS(s.supabase_count - b.bison_count) > 5
ORDER BY ABS(difference) DESC;
```

### Find Stale Workspaces
```sql
-- Workspaces with no updates in 24+ hours
SELECT
  workspace_name,
  MAX(last_synced_at) as last_sync,
  COUNT(*) as lead_count
FROM client_leads
GROUP BY workspace_name
HAVING MAX(last_synced_at) < NOW() - INTERVAL '24 hours'
ORDER BY last_sync;
```

### API Health Summary
```sql
-- Email Bison API health last 24 hours
SELECT
  endpoint,
  COUNT(*) as total_calls,
  AVG(response_time_ms) as avg_response_ms,
  COUNT(*) FILTER (WHERE success = false) as failures,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / COUNT(*), 2) as success_rate
FROM api_health_logs
WHERE api_name = 'Email Bison'
AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY failures DESC;
```

---

## Document Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-09 | 1.0 | Initial comprehensive audit |

---

**End of Audit**
