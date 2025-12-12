# System Architecture Diagrams

Visual diagrams to help understand the Perf Spotlight Portal architecture.

---

## Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        EXTERNAL DATA SOURCES                            │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │
│  │  EMAIL BISON    │  │    AIRTABLE     │  │  COLE X DATES   │       │
│  │    (Primary)    │  │    (Legacy)     │  │  (Lead Source)  │       │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘       │
│           │                    │                    │                  │
└───────────┼────────────────────┼────────────────────┼──────────────────┘
            │                    │                    │
            │ Webhooks           │ API Calls          │ Browser
            │ + API Polls        │                    │ Automation
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        SUPABASE BACKEND                                 │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │              EDGE FUNCTIONS (63 total)                        │    │
│  │                                                                │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │    │
│  │  │ hybrid-email-    │  │ hybrid-workspace-│                  │    │
│  │  │ accounts-v2      │  │ analytics        │                  │    │
│  │  │ (600+ accounts)  │  │ (KPI metrics)    │                  │    │
│  │  └──────────────────┘  └──────────────────┘                  │    │
│  │                                                                │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │    │
│  │  │ volume-dashboard │  │ revenue-         │                  │    │
│  │  │ -data            │  │ analytics        │                  │    │
│  │  └──────────────────┘  └──────────────────┘                  │    │
│  │                                                                │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │    │
│  │  │ universal-bison- │  │ sync-client-     │                  │    │
│  │  │ webhook          │  │ leads            │                  │    │
│  │  │ (Real-time)      │  │ (Batch sync)     │                  │    │
│  │  └──────────────────┘  └──────────────────┘                  │    │
│  │                                                                │    │
│  └────────────────────────────────┬───────────────────────────────┘    │
│                                   │                                    │
│  ┌────────────────────────────────▼───────────────────────────────┐   │
│  │             POSTGRESQL DATABASE                                 │   │
│  │                                                                 │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │   │
│  │  │ client_registry│  │ client_leads   │  │ sender_emails_ │  │   │
│  │  │ (Master Data)  │  │ (Lead Pipeline)│  │ cache          │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  │   │
│  │                                                                 │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │   │
│  │  │ email_account_ │  │ webhook_       │  │ provider_      │  │   │
│  │  │ metadata       │  │ delivery_log   │  │ performance    │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      │ REST API + Realtime
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        FRONTEND (React + TypeScript)                   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │                    DATA SERVICE LAYER                          │    │
│  │  - In-memory caching (TTL-based)                              │    │
│  │  - Request deduplication                                       │    │
│  │  - Retry logic with exponential backoff                       │    │
│  │  - Feature flags for gradual rollouts                         │    │
│  └────────────────────────────┬───────────────────────────────────┘    │
│                               │                                        │
│  ┌────────────────────────────▼───────────────────────────────────┐   │
│  │                    DASHBOARD PAGES                              │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │    KPI      │  │   Volume    │  │    Email    │           │   │
│  │  │  Dashboard  │  │  Dashboard  │  │  Accounts   │           │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │   Revenue   │  │   Client    │  │   Billing   │           │   │
│  │  │  Dashboard  │  │   Portal    │  │   Page      │           │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │  END USERS    │
                              │  (Browser)    │
                              └───────────────┘
```

---

## Data Flow: KPI Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER OPENS /kpi-dashboard                                     │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. REACT COMPONENT RENDERS                                       │
│    - KPIDashboard.tsx loads                                      │
│    - React Query calls fetchKPIData()                            │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. DATA SERVICE CHECKS CACHE                                     │
│    - Is there a pending request? → JOIN IT                       │
│    - Is cache valid (< 2 min old)? → RETURN CACHED DATA          │
│    - Otherwise → FETCH FRESH DATA                                │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. INVOKE EDGE FUNCTION                                          │
│    supabase.functions.invoke('hybrid-workspace-analytics')       │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. EDGE FUNCTION EXECUTES (hybrid-workspace-analytics)           │
│                                                                   │
│    a) Query client_registry for active clients                   │
│       SELECT * FROM client_registry WHERE is_active = true       │
│                                                                   │
│    b) Fetch Email Bison workspaces                               │
│       GET https://send.maverickmarketingllc.com/api/workspaces   │
│                                                                   │
│    c) For each workspace:                                        │
│       - Use workspace-specific API key (or switch context)       │
│       - Fetch stats for multiple time periods:                   │
│         * MTD (month-to-date)                                    │
│         * Last 7 days                                            │
│         * Last 30 days                                           │
│         * Last month                                             │
│                                                                   │
│    d) Calculate metrics:                                         │
│       - Daily average = MTD / days elapsed                       │
│       - Projected EOM = daily average × days in month            │
│       - Progress % = actual / target                             │
│       - Trends = compare time periods                            │
│                                                                   │
│    e) Return aggregated client data                              │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. DATA SERVICE VALIDATES & CACHES                               │
│    - Validate response structure                                 │
│    - Check for missing/invalid data                              │
│    - Store in cache with 2-minute TTL                            │
│    - Return to React component                                   │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. REACT COMPONENT RENDERS DASHBOARD                             │
│    - Display client cards with KPI metrics                       │
│    - Show progress bars and trend indicators                     │
│    - Highlight clients above/below target                        │
└──────────────────────────────────────────────────────────────────┘
```

**Performance:**
- Cold load: < 1 second
- Cached load: < 500ms (20x faster than before optimization)

---

## Data Flow: Email Accounts Page

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER OPENS /email-accounts                                    │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. EMAIL ACCOUNTS PAGE COMPONENT                                 │
│    - EmailAccountsPage.tsx loads                                 │
│    - Calls fetchInfrastructureData()                             │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. CHECK CACHE (60-minute TTL)                                   │
│    - Cache HIT → Return 600+ accounts instantly                  │
│    - Cache MISS → Fetch from Edge Function                       │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼ (if cache miss)
┌──────────────────────────────────────────────────────────────────┐
│ 4. INVOKE hybrid-email-accounts-v2 EDGE FUNCTION                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. EDGE FUNCTION PROCESSING                                      │
│                                                                   │
│    Step 1: Fetch all Email Bison workspaces                      │
│    ┌─────────────────────────────────────────────┐              │
│    │ GET /workspaces/v1.1                        │              │
│    │ Returns: [workspace1, workspace2, ...]      │              │
│    └─────────────────────────────────────────────┘              │
│                                                                   │
│    Step 2: For each workspace (sequential processing)            │
│    ┌─────────────────────────────────────────────┐              │
│    │ POST /workspaces/v1.1/switch-workspace      │              │
│    │ Body: { team_id: workspace.id }             │              │
│    └─────────────────────────────────────────────┘              │
│                                                                   │
│    Step 3: Fetch sender emails (paginated, 15 per page)          │
│    ┌─────────────────────────────────────────────┐              │
│    │ GET /sender-emails?per_page=15              │              │
│    │ Loop through pagination:                    │              │
│    │   - Page 1, 2, 3, ... until all fetched     │              │
│    │   - Timeout protection: 120s per workspace  │              │
│    │   - Max pages: 100 per workspace            │              │
│    └─────────────────────────────────────────────┘              │
│                                                                   │
│    Step 4: Extract metadata from tags                            │
│    ┌─────────────────────────────────────────────┐              │
│    │ Tags: ['CheapInboxes', 'Gmail', ...]        │              │
│    │ Extract:                                     │              │
│    │   - Reseller (CheapInboxes, Zapmail, etc.)  │              │
│    │   - Provider (Gmail, Outlook, etc.)         │              │
│    │   - Domain (from email address)             │              │
│    └─────────────────────────────────────────────┘              │
│                                                                   │
│    Step 5: Fetch manual overrides from Supabase                 │
│    ┌─────────────────────────────────────────────┐              │
│    │ SELECT * FROM email_account_metadata        │              │
│    │ Join with Email Bison data by email address │              │
│    └─────────────────────────────────────────────┘              │
│                                                                   │
│    Step 6: Calculate pricing dynamically                         │
│    ┌─────────────────────────────────────────────┐              │
│    │ CheapInboxes: $3.00                         │              │
│    │ Zapmail: $3.00                              │              │
│    │ Mailr: $0.91                                │              │
│    │ ScaledMail: $50/domain ÷ mailbox count      │              │
│    └─────────────────────────────────────────────┘              │
│                                                                   │
│    Step 7: Calculate daily sending limits                        │
│    ┌─────────────────────────────────────────────┐              │
│    │ Gmail/Outlook: 20 emails/day                │              │
│    │ Mailr: 495/domain ÷ mailbox count           │              │
│    │ ScaledMail: Tiered (5-8 based on domain)    │              │
│    └─────────────────────────────────────────────┘              │
│                                                                   │
│    Step 8: Deduplicate by email address                         │
│    ┌─────────────────────────────────────────────┐              │
│    │ Same email in multiple workspaces?          │              │
│    │ Keep first occurrence only                  │              │
│    └─────────────────────────────────────────────┘              │
│                                                                   │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. RETURN TO FRONTEND                                            │
│    - 600+ email accounts with metadata                           │
│    - Cached for 60 minutes                                       │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. RENDER EMAIL ACCOUNTS TABLE                                   │
│    - Searchable/filterable table                                 │
│    - Status indicators (Connected/Disconnected)                  │
│    - Provider breakdown charts                                   │
│    - Cost analysis                                               │
└──────────────────────────────────────────────────────────────────┘
```

**Performance:**
- First load: 30-60 seconds (fetches 600+ accounts from Email Bison)
- Cached: Instant (60-minute cache)
- Manual refresh: Available via refresh button

---

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                    client_registry                               │
│  ┌──────────────────────────────────────────────────┐           │
│  │ workspace_id (PK) │ workspace_name (UNIQUE)      │           │
│  │ display_name      │ is_active                    │           │
│  │ billing_type      │ monthly_kpi_target           │           │
│  │ price_per_lead    │ monthly_sending_target       │           │
│  │ bison_api_key     │ airtable_record_id           │           │
│  └──────────┬───────────────────────┬─────────────────┘          │
└─────────────┼───────────────────────┼────────────────────────────┘
              │                       │
              │ workspace_name        │ workspace_name
              │ (FK)                  │ (FK)
              │                       │
    ┌─────────▼───────┐      ┌───────▼────────┐
    │                 │      │                 │
┌───┴──────────────────┴──┐ ┌┴──────────────────────┴───┐
│   client_leads          │ │  sender_emails_cache      │
│  ┌────────────────────┐ │ │  ┌─────────────────────┐  │
│  │ workspace_name     │ │ │  │ workspace_name      │  │
│  │ lead_email         │ │ │  │ email_address       │  │
│  │ pipeline_stage     │ │ │  │ status              │  │
│  │ date_received      │ │ │  │ reply_rate_%        │  │
│  │ bison_conversation_│ │ │  │ price               │  │
│  │ _url               │ │ │  │ volume_per_account  │  │
│  └────────────────────┘ │ │  └─────────────────────┘  │
└─────────────────────────┘ └───────────────────────────┘
                                        │
                                        │ email_address
                                        │ (JOIN)
                                        │
                          ┌─────────────▼────────────┐
                          │  email_account_metadata  │
                          │  ┌────────────────────┐  │
                          │  │ email_address (PK) │  │
                          │  │ price (override)   │  │
                          │  │ daily_sending_limit│  │
                          │  │ notes              │  │
                          │  └────────────────────┘  │
                          └──────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  SUPPORTING TABLES                                       │
├──────────────────────────────────────────────────────────┤
│  - webhook_delivery_log    (webhook tracking)            │
│  - webhook_health          (monitoring)                  │
│  - provider_performance_   (historical analytics)        │
│    history                                               │
│  - client_zipcodes         (territory management)        │
│  - contact_upload_jobs     (pipeline processing)         │
└──────────────────────────────────────────────────────────┘
```

---

## Caching Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND DATA REQUEST                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  CHECK PENDING       │
                  │  REQUESTS            │
                  │  (Deduplication)     │
                  └─────┬────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │ REQUEST ALREADY       │
     ┌──YES─│ IN FLIGHT?            │
     │      └─────┬─────────────────┘
     │            │ NO
     │            ▼
     │  ┌──────────────────────┐
     │  │  CHECK IN-MEMORY     │
     │  │  CACHE               │
     │  └─────┬────────────────┘
     │        │
     │        ▼
     │  ┌─────────────────┐
     │  │ CACHE VALID?    │◄─────┐
     │  │ (age < TTL)     │      │
     │  └─┬───────┬───────┘      │
     │    │       │              │
     │    │       │ NO           │
     │YES │       ▼              │
     │    │  ┌──────────────┐   │
     │    │  │ FETCH FROM   │   │
     │    │  │ EDGE         │   │
     │    │  │ FUNCTION     │   │
     │    │  └──────┬───────┘   │
     │    │         │            │
     │    │         ▼            │
     │    │  ┌──────────────┐   │
     │    │  │ VALIDATE     │   │
     │    │  │ RESPONSE     │   │
     │    │  └──────┬───────┘   │
     │    │         │            │
     │    │         ▼            │
     │    │  ┌──────────────┐   │
     │    └─►│ STORE IN     │───┘
     │       │ CACHE        │
     │       └──────┬───────┘
     │              │
     └──────────────┤
                    │
                    ▼
         ┌──────────────────────┐
         │ RETURN DATA TO       │
         │ COMPONENT            │
         └──────────────────────┘

CACHE TTLs:
┌─────────────────────┬─────────┬──────────────────┐
│ Data Type           │ TTL     │ Reason           │
├─────────────────────┼─────────┼──────────────────┤
│ KPI Data            │ 2 min   │ High priority    │
│ Volume Data         │ 30 sec  │ Real-time needs  │
│ Infrastructure      │ 60 min  │ Rarely changes   │
│ Revenue Data        │ 10 sec  │ Important metric │
└─────────────────────┴─────────┴──────────────────┘
```

---

## Deployment Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                  LOCAL DEVELOPMENT                               │
│                                                                   │
│  1. Make changes to code                                         │
│  2. Test locally (npm run dev)                                   │
│  3. Verify in local Supabase Studio                              │
│  4. Commit to git                                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ git push origin main
                             │
         ┌───────────────────┼────────────────────┐
         │                   │                    │
         ▼                   ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  DATABASE      │  │  EDGE          │  │  FRONTEND      │
│  MIGRATIONS    │  │  FUNCTIONS     │  │  (React App)   │
└────────┬───────┘  └────────┬───────┘  └────────┬───────┘
         │                   │                    │
         │ supabase         │ supabase          │ git push
         │ db push          │ functions deploy  │ (automatic)
         │                   │                    │
         ▼                   ▼                    ▼
┌────────────────────────────────────────────────────────┐
│              PRODUCTION ENVIRONMENT                    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Supabase    │  │  Supabase    │  │   Netlify   │ │
│  │  Database    │  │  Edge Fns    │  │   (CDN)     │ │
│  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │   END USERS    │
                    └────────────────┘
```

---

## Local vs Production Environment

```
LOCAL DEVELOPMENT                          PRODUCTION
┌──────────────────────────┐              ┌──────────────────────────┐
│                          │              │                          │
│  Frontend (Vite)         │              │  Frontend (Netlify)      │
│  http://localhost:8080   │              │  https://production-url  │
│                          │              │                          │
└────────┬─────────────────┘              └────────┬─────────────────┘
         │                                          │
         │ .env.local                               │ Netlify Env Vars
         │ VITE_SUPABASE_URL=                       │ VITE_SUPABASE_URL=
         │   localhost:54321                        │   gjqbbgrfhijescaouqkx
         │                                          │
         ▼                                          ▼
┌──────────────────────────┐              ┌──────────────────────────┐
│                          │              │                          │
│  Supabase (Docker)       │              │  Supabase (Cloud)        │
│  http://localhost:54321  │              │  Production Project      │
│                          │              │                          │
│  - PostgreSQL            │              │  - PostgreSQL            │
│  - Edge Functions        │              │  - Edge Functions        │
│  - Studio UI             │              │  - Monitoring            │
│                          │              │  - Backups               │
│                          │              │                          │
└──────────────────────────┘              └──────────────────────────┘

SWITCHING:
1. Change .env.local
2. Restart npm run dev
3. Test against desired environment
```

---

**For more details, see:**
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Complete technical documentation
- [LOCAL_DEVELOPMENT_GUIDE.md](./LOCAL_DEVELOPMENT_GUIDE.md) - Setup instructions
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Common commands and tasks
