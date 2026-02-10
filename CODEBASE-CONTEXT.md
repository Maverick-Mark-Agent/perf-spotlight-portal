# Maverick Codebase Analysis

**Analyzed:** 2025-01-27
**Repos Reviewed:**
- `maverick-email-advantage`
- `maverick-platform`
- `perf-spotlight-portal`

---

## 1. Repository Overview

### 1.1 maverick-email-advantage
**Purpose:** Marketing landing page for Maverick Marketing services
**Status:** Simple static site, likely client-facing marketing

**Tech Stack:**
- Vite + React + TypeScript
- shadcn-ui + Tailwind CSS
- Built with Lovable.dev (AI-assisted development platform)

**Structure:**
```
maverick-email-advantage/
├── src/
│   ├── components/       # Hero, Services, About, Results, Contact, Footer
│   │   └── ui/           # shadcn-ui components
│   ├── hooks/            # use-mobile, use-toast
│   ├── lib/              # utils
│   └── pages/            # Index, NotFound
├── package.json
└── vite.config.ts
```

**Key Files:**
- `src/App.tsx` - Main app entry
- `src/components/Hero.tsx` - Landing page hero section
- `src/components/Services.tsx` - Services section
- `src/components/Results.tsx` - Results/testimonials section

**Assessment:** This is a standalone marketing site with no backend integration. It's purely presentational and serves as the public-facing brand presence.

---

### 1.2 maverick-platform
**Purpose:** Next-generation lead generation and client management platform
**Status:** IN DEVELOPMENT - Partially complete, designed to replace some perf-spotlight-portal functions

**Tech Stack:**

**Backend (Python):**
- FastAPI - REST API framework
- Celery + Redis - Distributed task queue for workers
- Supabase - PostgreSQL database + Auth
- Playwright - Browser automation for Xpressdocs scraping
- Pydantic - Data validation

**Frontend (Next.js Monorepo):**
- Next.js 14 (App Router)
- Tailwind CSS + shadcn-ui
- TanStack Query
- Supabase JS client
- Turborepo for monorepo management

**Structure:**
```
maverick-platform/
├── backend/
│   ├── app/
│   │   ├── api/v1/           # REST endpoints
│   │   │   ├── admin.py      # User/workspace management
│   │   │   ├── analytics.py  # KPI, revenue, volume analytics
│   │   │   ├── batches.py    # Contact batch management
│   │   │   ├── bison.py      # Email Bison integration
│   │   │   ├── campaigns.py  # Campaign management
│   │   │   ├── contacts.py   # Contact CRUD
│   │   │   ├── credentials.py # Credential management
│   │   │   ├── geo.py        # Geographic/ZIP data
│   │   │   ├── jobs.py       # Scraping job management
│   │   │   ├── leads.py      # Lead management (TODO)
│   │   │   ├── webhooks.py   # Webhook handlers
│   │   │   └── zipcodes.py   # ZIP code assignment
│   │   ├── core/             # Auth, database, config
│   │   ├── integrations/     # Email Bison client
│   │   ├── models/           # Pydantic models
│   │   ├── services/         # Business logic
│   │   │   ├── bison_token_service.py
│   │   │   ├── credential_service.py
│   │   │   ├── event_service.py
│   │   │   ├── job_service.py
│   │   │   └── pipeline_service.py
│   │   ├── utils/
│   │   └── workers/          # Celery tasks
│   │       ├── celery_app.py
│   │       ├── scrapers/     # Xpressdocs scraper
│   │       └── tasks/        # Celery task definitions
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
│
├── frontend/
│   ├── apps/
│   │   ├── landing/          # Public landing page
│   │   │   └── app/
│   │   │       ├── page.tsx
│   │   │       └── insurance-agencies/
│   │   └── dashboard/        # Admin dashboard
│   │       └── app/
│   │           ├── (dashboard)/
│   │           │   ├── page.tsx        # Main dashboard
│   │           │   ├── scraping/       # Scraping management
│   │           │   ├── contacts/       # Contact management
│   │           │   ├── campaigns/      # Campaign management
│   │           │   ├── analytics/      # Analytics views
│   │           │   ├── users/          # User management
│   │           │   └── settings/       # Settings
│   │           └── login/
│   └── packages/
│       ├── ui/               # Shared UI components
│       ├── database/         # Supabase client
│       ├── types/            # Shared TypeScript types
│       └── config/           # Shared configs
```

**Key API Endpoints:**
- `POST /api/v1/jobs/scrape` - Create scraping job
- `GET /api/v1/contacts` - List contacts
- `POST /api/v1/contacts/upload` - Upload CSV
- `GET /api/v1/analytics/kpi` - KPI dashboard data
- `POST /api/v1/admin/users` - Create user
- `POST /api/v1/zipcodes/assign` - Assign ZIP codes

**Worker Tasks:**
1. **Scraping Worker** - Xpressdocs automation with 10k record limit handling
2. **Verification Worker** - Batch email verification via Debounce
3. **Upload Worker** - CSV generation and Email Bison uploads
4. **CSV Processing Worker** - Parse and insert contacts
5. **Notification Worker** - Slack alerts

---

### 1.3 perf-spotlight-portal
**Purpose:** PRODUCTION client analytics and automation platform
**Status:** LIVE at https://perf-spotlight-portal.lovable.app
**This is the primary operational system**

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + shadcn-ui
- Backend: Supabase (PostgreSQL + 63+ Edge Functions)
- Automation: Playwright + BullMQ + Redis
- Integrations: Email Bison API, Clay API, Cole X Dates

**Structure:**
```
perf-spotlight-portal/
├── src/
│   ├── agents/              # Browser automation (Playwright)
│   ├── connectors/          # External integrations
│   │   ├── bison.ts         # Email Bison connector
│   │   ├── clay.ts          # Clay connector
│   │   ├── cole.ts          # Cole X Dates connector
│   │   └── *-config.ts      # Connector configs
│   ├── workflows/           # PT1-PT5 automated workflows
│   │   ├── pt1-cole-pulls.ts      # Monthly data pulls
│   │   ├── pt2-clay-format.ts     # Data formatting
│   │   ├── pt3-gap-analysis.ts    # Gap analysis
│   │   ├── pt4-bison-uploads.ts   # Email Bison uploads
│   │   └── pt5-evergreen-updates.ts
│   ├── orchestrator/        # BullMQ job queue
│   ├── pipeline/            # Lead processing
│   ├── pages/               # React pages
│   │   ├── KPIDashboard.tsx       # KPI metrics
│   │   ├── VolumeDashboard.tsx    # Volume tracking
│   │   ├── RevenueDashboard.tsx   # Revenue analytics
│   │   ├── ROIDashboard.tsx       # ROI tracking
│   │   ├── ClientPortalHub.tsx    # Client portal entry
│   │   ├── ClientPortalPage.tsx   # Individual client portal
│   │   ├── ClientManagement.tsx   # Admin client management
│   │   ├── ClientProfile.tsx      # Client profile page
│   │   ├── UserManagement.tsx     # User management
│   │   ├── EmailAccountsPage.tsx  # 600+ email accounts
│   │   ├── BillingPage.tsx        # Billing management
│   │   ├── RepliesDashboard.tsx   # Reply tracking
│   │   └── LiveRepliesBoard.tsx   # Real-time replies
│   ├── components/
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom hooks
│   │   ├── useRealtimeReplies.ts
│   │   ├── useRealtimeSubscription.ts
│   │   ├── useLiveReplies.ts
│   │   └── useSecureWorkspaceData.ts
│   ├── services/
│   │   ├── dataService.ts          # Data fetching + caching
│   │   ├── realtimeDataService.ts  # Real-time Supabase queries
│   │   └── userManagementService.ts
│   ├── lib/
│   └── types/
│
├── supabase/
│   ├── functions/           # 100+ Edge Functions
│   │   ├── sync-client-leads/
│   │   ├── universal-bison-webhook/
│   │   ├── hybrid-workspace-analytics/
│   │   ├── process-contact-upload/
│   │   ├── verify-contacts-debounce/
│   │   └── ...many more
│   └── migrations/          # 89+ database migrations
│
├── tests/                   # Playwright tests
├── scripts/                 # Maintenance scripts
└── docs/                    # Documentation
```

**Key Pages & Routes:**

**Public Routes:**
- `/` - Marketing home page
- `/login` - Login page

**Protected Client Portal Routes:**
- `/client-portal` - Client portal hub (all clients)
- `/client-portal/:workspace` - Individual client portal

**Admin Dashboard Routes (requires admin role):**
- `/admin` - Admin home dashboard
- `/kpi-dashboard` - KPI metrics dashboard
- `/volume-dashboard` - Email sending volume
- `/revenue-dashboard` - Revenue analytics
- `/roi-dashboard` - ROI tracking
- `/client-management` - Client CRUD
- `/client-management/:workspaceId` - Client profile
- `/user-management` - User CRUD
- `/email-accounts` - 600+ email account management
- `/live-replies` - Reply dashboard
- `/live-replies-board` - Real-time reply board

**Database Schema (Key Tables):**
- `client_registry` - Master client data, feature toggles
- `client_leads` - Lead management with pipeline stages
- `client_metrics` - KPI metrics (MTD)
- `email_account_metadata` - 600+ email account tracking
- `sender_emails_cache` - Real-time email cache
- `raw_leads` - Unprocessed leads from Cole X Dates
- `cleaned_leads` - Validated, enriched leads
- `client_zipcodes` - ZIP assignments by client/month
- `site_credentials` - Encrypted credentials
- `agent_runs` - Workflow execution tracking
- `agent_errors` - Error logging

---

## 2. Admin Perspective

### What Can an Admin Do?

**In perf-spotlight-portal (PRODUCTION):**

1. **KPI Dashboard** (`/kpi-dashboard`)
   - View positive replies, appointments, policies sold
   - Real-time metrics from Email Bison via webhooks
   - Month-over-month comparison
   - Client-specific filtering

2. **Volume Dashboard** (`/volume-dashboard`)
   - Daily lead volume tracking
   - Sending targets vs actuals
   - Slack notification triggers
   - Client volume breakdown

3. **Revenue Dashboard** (`/revenue-dashboard`)
   - Commission tracking per client
   - Monthly revenue analysis
   - Billing type (per lead vs retainer)

4. **Client Management** (`/client-management`)
   - View all clients (18+ workspaces)
   - Toggle feature flags per client:
     - `kpi_dashboard_enabled`
     - `volume_dashboard_enabled`
     - `live_replies_enabled`
     - `portal_access_enabled`
     - `disconnect_notifications_enabled`
   - Set monthly targets and payouts
   - Activate/deactivate clients

5. **Client Profile** (`/client-management/:workspaceId`)
   - Deep dive into individual client
   - Edit billing, targets, settings
   - View client-specific metrics

6. **User Management** (`/user-management`)
   - Create/edit/deactivate users
   - Assign roles (admin, user, client)
   - Assign users to workspaces

7. **Email Accounts** (`/email-accounts`)
   - Manage 600+ email sending accounts
   - Monitor health, warmup status
   - Track disconnections

8. **Live Replies** (`/live-replies`)
   - Real-time lead replies board
   - Pipeline stage management
   - Conversation URLs to Email Bison

**Admin Workflow:**
1. Log in at `/login`
2. Land on `/admin` dashboard - see activity feed, contact stats
3. Check `/kpi-dashboard` for daily performance
4. Review `/volume-dashboard` for sending health
5. Manage clients at `/client-management`
6. Monitor email infrastructure at `/email-accounts`
7. Track leads at `/live-replies`

---

## 3. Client Perspective

### What Can a Client See?

**In perf-spotlight-portal:**

1. **Client Portal Hub** (`/client-portal`)
   - Authentication required
   - List of workspaces assigned to user
   - Quick stats overview

2. **Client Portal Page** (`/client-portal/:workspace`)
   - **Kanban Board** for lead pipeline:
     - Interested → Quoting → Follow Up → Won → Lost
   - Drag-and-drop lead management
   - Lead details:
     - Contact info (name, email, phone, address)
     - Premium amount (if insurance)
     - Policy type
     - Conversation URL (link to Email Bison)
     - Notes
   - **KPI Stats** for their workspace
   - **Replies Tab** - View all replies
   - **Template Editor** - Manage email templates

**Client Workflow:**
1. Log in at `/login`
2. Navigate to `/client-portal`
3. Select their workspace
4. View lead pipeline in Kanban view
5. Drag leads between stages
6. Click leads to see details and respond
7. Track monthly KPIs at top of page

---

## 4. Integration Points

### How the Repos Connect

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Email Bison API     │  Cole X Dates  │  Clay API  │  Debounce API     │
│  (Campaign mgmt)     │  (Data pulls)  │  (Enrich)  │  (Email verify)   │
└──────────┬───────────┴───────┬────────┴─────┬──────┴────────┬──────────┘
           │                   │              │               │
           ▼                   ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   PERF-SPOTLIGHT-PORTAL (Production)                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐           │
│  │  Connectors   │    │  Workflows    │    │  Edge Funcs   │           │
│  │  (Playwright) │───▶│  (PT1-PT5)    │───▶│  (Supabase)   │           │
│  └───────────────┘    └───────────────┘    └───────────────┘           │
│           │                                        │                    │
│           ▼                                        ▼                    │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │             SUPABASE DATABASE (PostgreSQL)               │          │
│  │  - client_registry     - client_leads                    │          │
│  │  - raw_leads          - cleaned_leads                    │          │
│  │  - client_metrics     - email_account_metadata           │          │
│  └──────────────────────────────────────────────────────────┘          │
│           │                                                             │
│           ▼                                                             │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐           │
│  │   React UI    │    │   Webhooks    │    │  Real-time    │           │
│  │  (Dashboards) │◀───│  (Bison/etc)  │───▶│  Subscriptions│           │
│  └───────────────┘    └───────────────┘    └───────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
           │
           │ (Shared Supabase database)
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   MAVERICK-PLATFORM (In Development)                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐           │
│  │  FastAPI      │    │  Celery       │    │  Next.js      │           │
│  │  Backend      │───▶│  Workers      │    │  Frontend     │           │
│  └───────────────┘    └───────────────┘    └───────────────┘           │
│           │                   │                                         │
│           ▼                   ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │             SAME SUPABASE DATABASE                       │          │
│  │  (Connects to same DB as perf-spotlight-portal)          │          │
│  └──────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                   MAVERICK-EMAIL-ADVANTAGE (Static)                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐                                                      │
│  │  Landing Page │  ← No backend, purely static marketing site          │
│  │  (Vite+React) │                                                      │
│  └───────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Lead Generation Pipeline:**
   ```
   Cole X Dates → raw_leads → Clay (enrich) → cleaned_leads → Email Bison
   ```

2. **Lead Tracking Pipeline:**
   ```
   Email Bison → Webhook → Supabase → client_leads → Dashboard
   ```

3. **KPI Pipeline:**
   ```
   Email Bison API → Edge Functions → client_metrics → KPI Dashboard
   ```

### Shared Resources

- **Database:** Both perf-spotlight-portal and maverick-platform connect to the SAME Supabase instance
- **Auth:** Supabase Auth (shared)
- **Email Bison:** Both systems integrate with Email Bison via API
- **Credentials:** Stored in `site_credentials` table, accessed by both systems

---

## 5. Pain Points & Technical Debt

### Critical Issues

1. **Parallel Development Without Clear Migration Path**
   - `maverick-platform` and `perf-spotlight-portal` have overlapping functionality
   - No clear strategy for which system should handle what
   - Risk of data inconsistency if both systems modify same tables

2. **Duplicate API Integrations**
   - Email Bison client exists in BOTH repos:
     - `maverick-platform/backend/app/integrations/email_bison.py`
     - `perf-spotlight-portal/src/connectors/bison.ts`
   - No shared library = maintenance burden

3. **100+ Edge Functions in perf-spotlight-portal**
   - Difficult to maintain and test
   - Many appear to be one-off migrations or fixes
   - Examples: `add-kirk-hodgson`, `backfill-devin-dates`, `fix-missing-conversation-urls`

### TODOs Found in Code

```python
# maverick-platform/backend/app/integrations/email_bison.py
# TODO: Add custom variables once they are created in Email Bison workspace

# maverick-platform/backend/app/api/v1/leads.py
# TODO: Implement leads endpoints

# maverick-platform/backend/app/api/v1/admin.py
# TODO: Send invitation email via Supabase Auth

# maverick-platform/backend/app/workers/tasks/processing.py
# TODO: Implement Debounce API integration
```

### Deprecated Code

```python
# maverick-platform/backend/app/workers/tasks/batching.py
# DEPRECATED: This function now delegates to generate_monthly_batch.
```

### Technical Debt Indicators

1. **Test Endpoints in Production**
   ```python
   # maverick-platform/backend/app/api/router.py
   # Test endpoints (NO AUTH - disable in production!)
   api_router.include_router(test.router, prefix="/test", tags=["test"])
   ```

2. **Backup Files in Codebase**
   - `perf-spotlight-portal/src/pages/EmailAccountsPage.tsx.backup`
   - `perf-spotlight-portal/src/pages/ClientManagement.old.tsx`

3. **Hardcoded Values**
   - Server IP in trusted hosts: `31.220.56.218`
   - Magic numbers throughout (10k record limits, rate limits)

4. **Missing Environment Validation**
   - Some env vars have empty string defaults that could cause issues

5. **89+ Database Migrations**
   - Many appear to be hotfixes or one-off changes
   - Could benefit from consolidation

### Architecture Concerns

1. **Browser Automation Fragility**
   - Both repos use Playwright for browser automation (Cole, Clay, Email Bison)
   - Browser automation is inherently fragile (UI changes break everything)
   - Consider moving to API-based integrations where possible

2. **No Centralized Logging**
   - Each system has its own logging
   - No unified observability across the platform

3. **Redis Dependency Without HA**
   - Celery workers depend on Redis
   - No mention of Redis Sentinel or cluster mode

4. **Supabase Edge Function Limits**
   - 100+ functions may hit Supabase free tier limits
   - Cold start latency can be significant

---

## 6. Recommendations

### Immediate Actions

1. **Consolidate or Deprecate** - Decide if maverick-platform will replace perf-spotlight-portal or complement it
2. **Remove Test Endpoints** from production
3. **Delete Backup Files** from codebase (use git history)
4. **Document the Data Model** - Create ERD for all tables

### Medium-Term

1. **Create Shared Libraries** - Extract common code (Email Bison client, connectors)
2. **Consolidate Edge Functions** - Group related functions, remove one-offs
3. **Add Comprehensive Testing** - Unit tests for services, E2E for critical flows
4. **Implement Proper CI/CD** - Automated testing and deployment

### Long-Term

1. **Unified API Gateway** - Single entry point for all backend services
2. **Event-Driven Architecture** - Use webhooks/events instead of polling
3. **Observability Stack** - Centralized logging, metrics, tracing
4. **API-First Integrations** - Replace browser automation where possible

---

## 7. Quick Reference

### Repository Purposes

| Repo | Purpose | Status |
|------|---------|--------|
| `maverick-email-advantage` | Marketing landing page | Simple/Static |
| `maverick-platform` | Next-gen platform | In Development |
| `perf-spotlight-portal` | Production operations | LIVE |

### Key URLs

- Production Portal: `https://perf-spotlight-portal.lovable.app`
- Lovable Project: `https://lovable.dev/projects/ad87c4b8-0b3a-44f0-89e7-c815e1d9f5ad`

### Environment Files

- `maverick-platform/backend/.env.example`
- `perf-spotlight-portal/.env.local.example`
- `perf-spotlight-portal/.env.production.example`

### Documentation Locations

- `perf-spotlight-portal/SYSTEM_ARCHITECTURE.md` - Full system docs
- `perf-spotlight-portal/LOCAL_DEVELOPMENT_GUIDE.md` - Setup guide
- `perf-spotlight-portal/docs/AGENT_README.md` - Automation workflows
- `maverick-platform/README.md` - Platform overview
