# Perf Spotlight Portal - Complete System Architecture

**Last Updated:** October 15, 2025
**Project ID:** gjqbbgrfhijescaouqkx

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Components](#architecture-components)
3. [Database Schema](#database-schema)
4. [Edge Functions](#edge-functions)
5. [Frontend Pages](#frontend-pages)
6. [Data Flow](#data-flow)
7. [Local Development Setup](#local-development-setup)

---

## System Overview

The Perf Spotlight Portal is a **real-time performance dashboard** for Maverick Marketing that tracks:
- Client KPI metrics (lead generation, reply rates)
- Email sending volume across all clients
- Email account infrastructure (600+ accounts)
- Revenue analytics and billing
- Client lead management portal

### Technology Stack

- **Frontend:** React + TypeScript + Vite + Shadcn UI
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **External APIs:** Email Bison (primary data source)
- **Deployment:** Netlify (frontend), Supabase (backend)

### Key Design Principles

1. **Real-time Data:** Email Bison webhooks + polling for live updates
2. **Performance:** In-memory caching + database materialized views
3. **Reliability:** Edge Functions with retry logic + stale cache fallbacks
4. **Scalability:** Feature flags for gradual rollouts

---

## Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   KPI    │  │  Volume  │  │   Email  │  │ Revenue  │   │
│  │Dashboard │  │Dashboard │  │ Accounts │  │Dashboard │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              DATA SERVICE LAYER (TypeScript)                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  dataService.ts - Caching + Feature Flags          │   │
│  │  - In-memory cache (TTL-based)                     │   │
│  │  - Request deduplication                           │   │
│  │  - Exponential backoff retry                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Deno)                 │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ hybrid-email-        │  │ hybrid-workspace-    │        │
│  │ accounts-v2          │  │ analytics            │        │
│  │ (Email Accounts)     │  │ (KPI Data)           │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ volume-dashboard-    │  │ revenue-analytics    │        │
│  │ data                 │  │                      │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                SUPABASE DATABASE (PostgreSQL)               │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ client_registry      │  │ client_leads         │        │
│  │ (Master Client Data) │  │ (Lead Management)    │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ email_account_       │  │ sender_emails_cache  │        │
│  │ metadata             │  │ (Real-time Cache)    │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   EMAIL BISON API                           │
│  - Workspaces API (v1.1)                                    │
│  - Sender Emails API (paginated)                            │
│  - Stats API (time-series data)                             │
│  - Webhooks (real-time events)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### 1. `client_registry` (Master Client Data)
**Purpose:** Single source of truth for all clients

```sql
CREATE TABLE client_registry (
  workspace_id INTEGER PRIMARY KEY,           -- Email Bison workspace ID
  workspace_name TEXT NOT NULL UNIQUE,        -- SOURCE OF TRUTH
  display_name TEXT,                          -- Optional pretty name
  is_active BOOLEAN DEFAULT true,

  -- Billing
  billing_type TEXT CHECK (billing_type IN ('per_lead', 'retainer')),
  price_per_lead DECIMAL(10,2),
  retainer_amount DECIMAL(10,2),

  -- Targets
  monthly_kpi_target INTEGER DEFAULT 0,
  monthly_sending_target INTEGER DEFAULT 0,
  payout DECIMAL(10,2),

  -- Integration
  airtable_record_id TEXT,
  bison_api_key TEXT,                         -- Workspace-specific API key

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Indexes:**
- `idx_client_registry_workspace_name` - Fast lookup by name
- `idx_client_registry_active` - Filter active clients

---

#### 2. `client_leads` (Lead Management)
**Purpose:** Store and manage client leads from Email Bison

```sql
CREATE TABLE client_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE NOT NULL,
  workspace_name TEXT NOT NULL,

  -- Contact Info
  lead_email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,

  -- Lead Details
  date_received TIMESTAMPTZ,
  reply_received TEXT,
  campaign_name TEXT,
  sender_email TEXT,
  lead_value DECIMAL(10,2) DEFAULT 500,

  -- Pipeline
  pipeline_stage TEXT DEFAULT 'new',
  pipeline_position INTEGER DEFAULT 0,
  notes TEXT,

  -- Email Bison Integration
  bison_conversation_url TEXT,
  bison_lead_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Indexes:**
- `idx_client_leads_workspace` - Per-client queries
- `idx_client_leads_pipeline` - Pipeline views
- `idx_client_leads_date` - Time-based sorting

---

#### 3. `sender_emails_cache` (Real-time Email Account Cache)
**Purpose:** Cache Email Bison email account data for fast access

```sql
CREATE TABLE sender_emails_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  email_address TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  bison_workspace_id INTEGER NOT NULL,
  bison_instance TEXT NOT NULL,              -- 'Maverick' or 'Long Run'

  -- Metrics
  emails_sent_count INTEGER DEFAULT 0,
  unique_replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  interested_leads_count INTEGER DEFAULT 0,

  -- Calculated
  reply_rate_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN emails_sent_count > 0
    THEN ROUND((unique_replied_count::decimal / emails_sent_count::decimal) * 100, 2)
    ELSE 0 END
  ) STORED,

  -- Status
  status TEXT CHECK (status IN ('Connected', 'Disconnected', 'Failed', 'Not connected')),
  daily_limit INTEGER DEFAULT 0,

  -- Provider Info
  email_provider TEXT,                        -- 'Gmail', 'Outlook', etc.
  reseller TEXT,                              -- 'CheapInboxes', 'Zapmail', etc.
  domain TEXT,

  -- Pricing
  price DECIMAL(10,2),
  volume_per_account INTEGER,

  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_address, workspace_name)
);
```

**Key Indexes:**
- `idx_sender_emails_cache_workspace` - Per-client queries
- `idx_sender_emails_cache_provider` - Provider analysis
- `idx_sender_emails_cache_status` - Status filtering

---

#### 4. `email_account_metadata` (Manual Overrides)
**Purpose:** Store manual price/config overrides for email accounts

```sql
CREATE TABLE email_account_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL UNIQUE,
  price DECIMAL(10,2) DEFAULT 0,
  daily_sending_limit INTEGER,
  notes TEXT,
  custom_tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Usage:** Edge Functions check this table first for manual overrides before using calculated values.

---

### Supporting Tables

- `webhook_delivery_log` - Track all webhook events
- `webhook_health` - Monitor webhook health per workspace
- `provider_performance_history` - Daily provider performance snapshots
- `client_zipcodes` - Territory management
- `contact_upload_jobs` - Contact pipeline processing

---

## Edge Functions

Total: **63 Edge Functions** deployed

### Critical Production Functions

#### 1. `hybrid-email-accounts-v2`
**Purpose:** Fetch all email accounts from Email Bison with pagination

**Data Flow:**
1. Fetch all workspaces from Email Bison API
2. For each workspace:
   - Switch workspace context
   - Paginate through all sender emails (15 per page)
   - Extract tags for provider/reseller
3. Fetch manual overrides from `email_account_metadata`
4. Calculate pricing dynamically
5. Deduplicate by email address
6. Return merged records

**Key Logic:**
```typescript
// Pricing calculation
function calculatePrice(provider, accountType, domain, domainCounts) {
  if (provider === 'CheapInboxes') return { price: 3.00 };
  if (provider === 'Zapmail') return { price: 3.00 };
  if (provider === 'Mailr') return { price: 0.91 };
  if (provider === 'ScaledMail') {
    const mailboxCount = domainCounts.get(domain);
    return { price: 50 / mailboxCount };
  }
  return { price: 0, needsReview: true };
}
```

**Performance:** ~30-60 seconds for 600+ accounts

---

#### 2. `hybrid-workspace-analytics`
**Purpose:** Fetch KPI metrics for all active clients

**Data Flow:**
1. Fetch active clients from `client_registry`
2. Fetch all Email Bison workspaces
3. For each eligible workspace:
   - Use workspace-specific API key (no context switching!)
   - Fetch stats for MTD, last 7 days, last 30 days, last month
   - Extract interested lead counts
   - Calculate projections and trends
4. Return aggregated client data

**Key Metrics Calculated:**
- `projectedReplies = (MTD replies / days elapsed) × days in month`
- `currentProgress = MTD replies / monthly KPI`
- `projectionProgress = projected replies / monthly KPI`

**Performance:** ~10-20 seconds for 20+ clients

---

#### 3. `volume-dashboard-data`
**Purpose:** Fetch email sending volume metrics

**Data Flow:**
1. Fetch active clients from `client_registry`
2. Query Email Bison for email counts
3. Calculate projections and variance
4. Return volume data with targets

---

#### 4. `revenue-analytics`
**Purpose:** Calculate revenue and billing metrics

**Data Flow:**
1. Fetch leads from `client_leads`
2. Calculate revenue by client
3. Aggregate totals and projections
4. Return revenue breakdown

---

#### 5. `universal-bison-webhook`
**Purpose:** Handle real-time webhooks from Email Bison

**Supported Events:**
- `lead_interested` - Positive reply received
- `email_sent` - Email sent
- `email_bounced` - Email bounced
- `account_disconnected` - Account connection lost

**Actions:**
- Update `sender_emails_cache`
- Insert into `webhook_delivery_log`
- Update `webhook_health` metrics
- Send Slack notifications (for important events)

---

### Supporting Functions

- `airtable-clients` - Sync client data from Airtable (legacy)
- `sync-client-leads` - Sync leads from Airtable
- `sync-all-metrics` - Batch sync all metrics
- `daily-webhook-health-check` - Monitor webhook health
- `generate-workspace-api-keys` - Generate workspace-specific API keys

---

## Frontend Pages

### Dashboard Pages

#### 1. **KPI Dashboard** (`/kpi-dashboard`)
**Component:** `src/pages/KPIDashboard.tsx`
**Data Source:** `fetchKPIData()` → `hybrid-workspace-analytics` Edge Function
**Features:**
- Lead generation progress per client
- Monthly KPI tracking
- Projections to end of month
- Week-over-week and month-over-month comparisons
- Visual progress bars and trend indicators

**Key Metrics:**
- Positive Replies MTD
- Projected Replies (EOM)
- Monthly KPI Target
- Current Progress %
- Last 7/30 days trends

---

#### 2. **Volume Dashboard** (`/volume-dashboard`)
**Component:** `src/pages/VolumeDashboard.tsx`
**Data Source:** `fetchVolumeData()` → `volume-dashboard-data` Edge Function
**Features:**
- Email sending volume by client
- Target vs actual comparisons
- Projections
- Geographic heatmap (US states)
- Time series charts

---

#### 3. **Email Accounts Page** (`/email-accounts`)
**Component:** `src/pages/EmailAccountsPage.tsx`
**Data Source:** `fetchInfrastructureData()` → `hybrid-email-accounts-v2` Edge Function
**Features:**
- 600+ email account management
- Status tracking (Connected/Disconnected/Failed)
- Provider breakdown (Gmail vs Outlook)
- Reply rate analysis
- Cost analysis
- Filters by workspace, status, provider

**Performance Notes:**
- Uses 60-minute cache (longest TTL)
- Prevents constant API polling
- Manual refresh available

---

#### 4. **Revenue Dashboard** (`/revenue-dashboard`)
**Component:** `src/pages/RevenueDashboard.tsx`
**Data Source:** `fetchRevenueData()` → `revenue-analytics` Edge Function
**Features:**
- Revenue by client
- Per-lead vs retainer billing
- Monthly projections
- Total revenue tracking

---

#### 5. **Client Portal** (`/client-portal/:workspace`)
**Component:** `src/pages/ClientPortalPage.tsx`
**Data Source:** Direct Supabase query to `client_leads`
**Features:**
- Client-specific lead management
- Pipeline stages (New, Follow-up, Quoting, Won, Lost)
- Drag-and-drop lead organization
- Lead details and notes
- Email Bison conversation links

---

### Utility Pages

- **Home Page** (`/`) - Navigation hub
- **Billing Page** (`/billing`) - Cost analysis
- **Contact Pipeline** (`/contact-pipeline`) - Lead upload workflow
- **ZIP Dashboard** (`/zip-dashboard`) - Territory management
- **Client Management** (`/client-management`) - Admin client config

---

## Data Flow

### Example: KPI Dashboard Load

```
1. User opens /kpi-dashboard
   ↓
2. KPIDashboard.tsx renders
   ↓
3. React Query calls fetchKPIData()
   ↓
4. dataService.ts checks:
   - Is there a pending request? → Join it
   - Is cache valid? → Return cached data
   - Otherwise → Fetch fresh data
   ↓
5. If fetching, invoke hybrid-workspace-analytics Edge Function
   ↓
6. Edge Function:
   a. Queries client_registry for active clients
   b. Fetches Email Bison workspaces
   c. For each workspace:
      - Fetches stats from Email Bison API
      - Calculates projections
   d. Returns aggregated data
   ↓
7. dataService validates and caches response
   ↓
8. KPIDashboard renders with data
```

### Cache Strategy

**Cache TTLs:**
- KPI Data: 2 minutes
- Volume Data: 30 seconds
- Infrastructure Data: 60 minutes (longest)
- Revenue Data: 10 seconds

**Cache Features:**
- In-memory cache (Map-based)
- Request deduplication
- Stale-while-revalidate pattern
- Exponential backoff retry on failure

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase CLI
- Git

### Step 1: Clone and Install

```bash
cd /Users/mac/Downloads/perf-spotlight-portal
npm install
```

### Step 2: Environment Variables

Create `.env.local` for local development:

```bash
# Supabase - Use LOCAL instance
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key

# For production testing, use:
# VITE_SUPABASE_URL=https://gjqbbgrfhijescaouqkx.supabase.co
# VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

### Step 3: Start Supabase Locally

```bash
# Initialize Supabase (first time only)
supabase init

# Start local Supabase (Docker required)
supabase start

# This will output:
# - API URL: http://localhost:54321
# - Studio URL: http://localhost:54323
# - anon key: eyJhbGc...
# - service_role key: eyJhbGc...
```

### Step 4: Run Migrations

```bash
# Apply all migrations to local database
supabase db reset

# Or apply specific migration
supabase db push
```

### Step 5: Start Development Server

```bash
npm run dev

# Opens on http://localhost:8080
```

### Step 6: Test Changes Locally

1. Make changes to frontend or Edge Functions
2. Test in local environment
3. Verify data flows correctly
4. Check console for errors

### Step 7: Deploy to Production

```bash
# Deploy Edge Functions
supabase functions deploy hybrid-email-accounts-v2
supabase functions deploy hybrid-workspace-analytics

# Or deploy all functions
for func in supabase/functions/*/; do
  func_name=$(basename "$func")
  supabase functions deploy "$func_name"
done

# Push database migrations
supabase db push

# Deploy frontend (handled by Netlify on git push)
git push origin main
```

---

## Feature Flags

Located in `src/services/dataService.ts`:

```typescript
const FEATURE_FLAGS = {
  useRealtimeInfrastructure: false,  // Keep using Edge Function
  useRealtimeKPI: true,               // Use direct DB query
  useRealtimeVolume: true,            // Use direct DB query
};
```

**How to Rollback:**
If a real-time feature breaks, simply set flag to `false` and redeploy frontend. No database changes needed!

---

## Common Operations

### Add New Client

1. Add to `client_registry` table:
```sql
INSERT INTO client_registry (
  workspace_id,
  workspace_name,
  display_name,
  is_active,
  billing_type,
  monthly_kpi_target
) VALUES (
  12345,
  'Client Workspace Name',
  'Client Display Name',
  true,
  'per_lead',
  50
);
```

2. Client will automatically appear in all dashboards

### Update Email Account Price

```sql
INSERT INTO email_account_metadata (email_address, price, notes)
VALUES ('account@domain.com', 5.00, 'Custom pricing')
ON CONFLICT (email_address)
DO UPDATE SET price = EXCLUDED.price, notes = EXCLUDED.notes;
```

### Clear Cache

```javascript
// In browser console
import { clearAllCache } from '@/services/dataService';
clearAllCache();
```

---

## Performance Metrics

### Before Optimization
- KPI Dashboard: 5-10 seconds
- Volume Dashboard: 3-5 seconds
- Infrastructure: 30-60 seconds

### After Optimization
- KPI Dashboard: <500ms (20x faster)
- Volume Dashboard: <300ms (15x faster)
- Infrastructure: <2 seconds (15x faster, with 60-min cache)

---

## Security Notes

1. **RLS Policies:** All tables have Row Level Security enabled
2. **Service Role Key:** Only used in Edge Functions (server-side)
3. **Anon Key:** Used in frontend (client-side)
4. **API Keys:** Email Bison API keys stored as Supabase secrets

---

## Troubleshooting

### Dashboard not loading?
1. Check browser console for errors
2. Verify Supabase connection
3. Check Edge Function logs in Supabase Dashboard
4. Try force refresh with cache clear

### Email accounts not showing?
1. Verify `EMAIL_BISON_API_KEY` is set in Supabase secrets
2. Check Edge Function logs for API errors
3. Verify Email Bison API is responding
4. Clear infrastructure cache and refresh

### Leads not syncing?
1. Check `client_leads` table for data
2. Verify Airtable sync is running
3. Check webhook logs in `webhook_delivery_log`

---

## Additional Resources

- **Supabase Dashboard:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx
- **Email Bison API Docs:** (contact Email Bison support)
- **Deployment Logs:** Check Netlify and Supabase dashboards

---

**End of System Architecture Document**
