# Technical Architecture Document - Maverick Marketing Portal

**Generated:** 2025-01-27  
**Purpose:** Complete technical architecture documentation for rebuilding this project from scratch

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Patterns](#architecture-patterns)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Architecture](#database-architecture)
7. [API Architecture](#api-architecture)
8. [Integration Architecture](#integration-architecture)
9. [Authentication & Authorization](#authentication--authorization)
10. [Data Flow Architecture](#data-flow-architecture)
11. [Workflow Architecture](#workflow-architecture)
12. [Deployment Architecture](#deployment-architecture)
13. [Security Architecture](#security-architecture)
14. [Monitoring & Logging](#monitoring--logging)
15. [Performance Architecture](#performance-architecture)

---

## System Overview

### Architecture Type

**Hybrid Serverless Architecture:**
- Frontend: Static React SPA (Vite)
- Backend: Supabase (PostgreSQL + Edge Functions)
- Automation: Node.js scripts with Playwright + BullMQ
- Caching: Redis for job queues
- Hosting: Lovable/Vercel (frontend), Supabase (backend)

### System Components

```
┌─────────────────┐
│   React SPA      │ (Frontend)
│   (Vite)        │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   Supabase      │ (Backend)
│   - PostgreSQL   │
│   - Edge Funcs   │
│   - Auth         │
│   - Realtime     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│ Redis  │ │ External │
│ Queue  │ │ APIs     │
└────────┘ └──────────┘
```

---

## Technology Stack

### Frontend

**Core Framework:**
- **React 18.3.1** - UI library
- **TypeScript 5.8.3** - Type safety
- **Vite 5.4.19** - Build tool & dev server

**UI Libraries:**
- **shadcn/ui** - Component library (Radix UI primitives)
- **Tailwind CSS 3.4.17** - Utility-first CSS
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library

**State Management:**
- **React Context API** - Global state (DashboardContext, ThemeContext)
- **TanStack Query 5.90.2** - Server state management
- **React Hook Form 7.61.1** - Form state management

**Routing:**
- **React Router DOM 6.30.1** - Client-side routing

**Data Visualization:**
- **Recharts 2.15.4** - Chart library
- **Plotly.js 3.1.1** - Advanced charts (maps)
- **react-leaflet 4.2.1** - Map components
- **D3 Geo 3.1.1** - Geographic utilities

**Drag & Drop:**
- **@dnd-kit/core 6.3.1** - Drag and drop
- **@dnd-kit/sortable 10.0.0** - Sortable lists

**Utilities:**
- **date-fns 3.6.0** - Date manipulation
- **zod 3.25.76** - Schema validation
- **clsx 2.1.1** - Conditional classnames
- **tailwind-merge 2.6.0** - Tailwind class merging

### Backend

**Database:**
- **PostgreSQL** (via Supabase)
- **Row Level Security (RLS)** - Data access control
- **PostgREST** - Auto-generated REST API

**Serverless Functions:**
- **Supabase Edge Functions** (Deno runtime)
- **TypeScript** - Function language

**Background Jobs:**
- **BullMQ 5.60.0** - Job queue system
- **ioredis 5.8.0** - Redis client

**Automation:**
- **Playwright 1.55.1** - Browser automation
- **Node.js** - Runtime environment

**Database Client:**
- **@supabase/supabase-js 2.57.4** - Supabase client library
- **pg 8.16.3** - PostgreSQL client (server-side)

### Infrastructure

**Hosting:**
- **Lovable/Vercel** - Frontend hosting
- **Supabase Cloud** - Backend hosting

**Caching:**
- **Redis** - Job queue and caching

**Monitoring:**
- **Slack Webhooks** - Notifications
- **Structured Logging** - Custom logger

**CI/CD:**
- **Git** - Version control
- **Lovable** - Auto-deployment

---

## Architecture Patterns

### Frontend Patterns

**1. Component-Based Architecture**
- Atomic design principles
- Reusable UI components
- Composition over inheritance

**2. Container/Presenter Pattern**
- Pages as containers
- Components as presenters
- Logic separation

**3. Context Pattern**
- Global state via Context API
- Dashboard state management
- Theme management

**4. Custom Hooks Pattern**
- Reusable business logic
- Data fetching hooks
- Utility hooks

**5. Protected Route Pattern**
- Route-level authentication
- Role-based route protection
- Automatic redirects

### Backend Patterns

**1. Serverless Functions**
- Edge Functions for API endpoints
- Stateless functions
- Event-driven architecture

**2. Database-First Architecture**
- PostgreSQL as source of truth
- RLS for security
- Stored procedures for complex logic

**3. Job Queue Pattern**
- BullMQ for async tasks
- Worker processes
- Retry logic

**4. Event-Driven Pattern**
- Webhooks for real-time updates
- Database triggers
- Realtime subscriptions

### Data Patterns

**1. Repository Pattern**
- Service layer abstraction
- Data access encapsulation

**2. CQRS (Partial)**
- Separate read/write models
- Views for complex queries
- Aggregation patterns

**3. Event Sourcing (Partial)**
- Audit logs
- Historical tracking
- Operation history

---

## Frontend Architecture

### Project Structure

```
src/
├── agents/              # Browser automation
│   └── browser/         # Playwright controllers
├── components/           # React components
│   ├── auth/            # Auth components
│   ├── client-portal/   # Client portal components
│   ├── dashboard/       # Dashboard components
│   ├── EmailInfrastructure/ # Email monitoring
│   ├── layout/          # Layout components
│   └── ui/              # shadcn/ui components
├── connectors/          # External API connectors
├── contexts/            # React contexts
├── hooks/               # Custom React hooks
├── integrations/        # External integrations
│   └── supabase/        # Supabase client
├── lib/                 # Utility libraries
├── orchestrator/        # Job queue management
├── pages/               # Page components
├── pipeline/            # Data processing pipeline
├── services/            # Business logic services
├── types/               # TypeScript types
├── utils/               # Utility functions
├── workflows/           # Automated workflows (PT1-PT5)
├── App.tsx              # Root component
└── main.tsx             # Entry point
```

### Component Hierarchy

```
App
├── ErrorBoundary
├── QueryClientProvider
├── ThemeProvider
├── DashboardProvider
├── TooltipProvider
└── BrowserRouter
    └── Routes
        ├── MarketingHomePage (public)
        ├── LoginPage (public)
        ├── ClientPortalHub (protected)
        ├── ClientPortalPage (protected)
        └── Admin Routes (admin-protected)
            ├── HomePage
            ├── KPIDashboard
            ├── VolumeDashboard
            ├── RevenueDashboard
            └── ...
```

### State Management

**Global State (Context API):**
- `DashboardContext` - Dashboard data and state
- `ThemeContext` - Theme preference

**Server State (TanStack Query):**
- API responses caching
- Automatic refetching
- Optimistic updates

**Local State (React Hooks):**
- Component-level state
- Form state (React Hook Form)
- UI state (modals, dropdowns)

### Routing Architecture

**Route Structure:**
```
/                          → MarketingHomePage (public)
/login                     → LoginPage (public)
/client-portal             → ClientPortalHub (protected)
/client-portal/:workspace  → ClientPortalPage (protected)
/admin                     → HomePage (admin)
/kpi-dashboard             → KPIDashboard (admin)
/volume-dashboard          → VolumeDashboard (admin)
/revenue-dashboard         → RevenueDashboard (admin)
/roi-dashboard             → ROIDashboard (admin)
/zip-dashboard             → ZipDashboard (admin)
/contact-pipeline           → ContactPipelineDashboard (admin)
/email-accounts             → EmailAccountsPage (admin)
/rollout-progress           → RolloutProgress (admin)
/client-management          → ClientManagement (admin)
/client-management/:id      → ClientProfile (admin)
/user-management            → UserManagement (admin)
```

**Route Protection:**
- `ProtectedRoute` - Requires authentication
- `AdminProtectedRoute` - Requires admin role
- Auto-redirect to `/login` if unauthenticated

### Build Configuration

**Vite Config:**
- Code splitting by vendor
- Manual chunks:
  - `vendor`: React, React-DOM
  - `router`: React Router
  - `ui`: Radix UI components
  - `charts`: Recharts
  - `supabase`: Supabase client
- SWC for fast compilation
- Path aliases: `@/` → `src/`

---

## Backend Architecture

### Supabase Edge Functions

**Function Categories:**

1. **Analytics Functions:**
   - `hybrid-workspace-analytics` - Client KPI aggregation
   - `hybrid-email-accounts` - Email account sync
   - `revenue-analytics` - Revenue calculations

2. **Webhook Handlers:**
   - `bison-interested-webhook` - Email Bison lead webhook

3. **Data Processing:**
   - `process-contact-upload` - CSV parsing and validation
   - `generate-weekly-batches` - Batch generation logic

4. **User Management:**
   - `admin-create-user` - User creation
   - `manage-users` - User CRUD operations

5. **Utilities:**
   - `exec-sql` - SQL execution endpoint
   - `get-workspace-data` - Workspace data retrieval

**Function Structure:**
```typescript
// Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(url, key)
  // Function logic
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  })
})
```

### Database Functions

**Stored Procedures:**
- `get_user_workspaces()` - Returns user accessible workspaces
- `daily_billable_revenue()` - Calculates daily revenue
- `increment_metric()` - Increments metric counters
- `handle_client_leads_updated_at()` - Auto-update timestamp

**Views:**
- `monthly_contact_pipeline_summary` - Pipeline progress aggregation
- `weekly_batch_status` - Batch status overview
- `client_revenue_mtd` - Monthly revenue totals

### Cron Jobs

**Scheduled Jobs (pg_cron):**
- `daily_kpi_sync` - Syncs KPIs from Email Bison daily
- `email_account_polling` - Polls email accounts at midnight
- `campaign_sync_cron` - Syncs campaigns periodically

---

## Database Architecture

### Schema Overview

**Core Tables:**

1. **Lead Management:**
   - `client_leads` - Primary lead table with pipeline stages
   - `raw_leads` - Unprocessed leads from Cole
   - `cleaned_leads` - Validated and enriched leads
   - `monthly_cleaned_leads` - Monthly aggregation

2. **Client Management:**
   - `client_registry` - Client/workspace configuration
   - `client_settings` - Client-specific settings
   - `client_pricing` - Billing configuration
   - `client_costs` - Cost tracking
   - `client_zipcodes` - ZIP code assignments

3. **Contact Pipeline:**
   - `raw_contacts` - Uploaded CSV contacts
   - `verified_contacts` - Email-verified contacts
   - `weekly_batches` - Weekly batch tracking
   - `upload_audit_log` - Upload operation logs
   - `debounce_usage` - Email verification usage

4. **User Management:**
   - `auth.users` - Supabase Auth users (managed by Supabase)
   - `user_workspace_access` - Workspace permissions

5. **Email Infrastructure:**
   - `email_accounts` - Email account records
   - `email_account_metadata` - Account metadata
   - `email_account_polling` - Polling job status

6. **Revenue:**
   - `client_pricing` - Pricing configuration
   - `client_costs` - Cost records
   - `monthly_revenue_snapshots` - Historical snapshots
   - `client_revenue_mtd` - Month-to-date revenue view

7. **Automation:**
   - `agent_runs` - Workflow execution logs
   - `agent_errors` - Error tracking with screenshots
   - `site_credentials` - Encrypted credentials

8. **Monitoring:**
   - `monitoring_tables` - System monitoring
   - `polling_job_status` - Job status tracking
   - `sync_progress` - Sync operation tracking

### Database Design Patterns

**1. Row Level Security (RLS):**
- Workspace-based data isolation
- Role-based access policies
- User workspace filtering

**2. Soft Deletes:**
- `deleted_at` timestamp
- Data retention
- Audit trail

**3. Timestamps:**
- `created_at` - Record creation
- `updated_at` - Auto-updated on change
- `last_synced_at` - Last sync time

**4. UUID Primary Keys:**
- `gen_random_uuid()` for IDs
- Better distribution
- No sequential leaks

**5. JSONB Fields:**
- Flexible schema (custom_variables, tags)
- Queryable JSON data
- Metadata storage

### Indexes

**Performance Indexes:**
- Workspace-based queries: `workspace_name`
- Pipeline filtering: `pipeline_stage`
- Date queries: `date_received DESC`
- Foreign keys: Foreign key columns
- Composite indexes: `(workspace_name, month)`

### Relationships

**Key Relationships:**
```
client_registry (1) ──→ (many) client_leads
client_registry (1) ──→ (many) client_zipcodes
client_registry (1) ──→ (1) client_pricing
client_registry (1) ──→ (many) client_costs
auth.users (1) ──→ (many) user_workspace_access
user_workspace_access (many) ──→ (1) client_registry
raw_contacts (1) ──→ (1) verified_contacts
verified_contacts (many) ──→ (1) weekly_batches
weekly_batches (1) ──→ (many) upload_audit_log
```

---

## API Architecture

### Supabase Client API

**Auto-Generated REST API:**
- PostgREST auto-generates REST endpoints
- Table-based endpoints: `/rest/v1/{table}`
- Query parameters: `select`, `filter`, `order`, `limit`

**Example:**
```typescript
// Get leads for workspace
supabase
  .from('client_leads')
  .select('*')
  .eq('workspace_name', workspace)
  .order('date_received', { ascending: false })
```

### Edge Function APIs

**Function Invocation:**
```typescript
// Invoke edge function
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param: value }
})
```

**Function Endpoints:**
- `hybrid-workspace-analytics` - GET/POST analytics data
- `hybrid-email-accounts` - GET email account sync
- `bison-interested-webhook` - POST webhook handler
- `process-contact-upload` - POST CSV processing
- `revenue-analytics` - GET revenue calculations

### External APIs

**Email Bison API:**
- REST API
- Workspace-based authentication
- Endpoints: login, campaigns, contacts, leads

**Clay API:**
- Browser automation primary
- REST API for some operations
- Email verification via Debounce

**Cole X Dates:**
- Browser automation only
- No direct API
- Playwright-based scraping

**Debounce API:**
- Email verification REST API
- Credit-based usage
- Batch verification support

---

## Integration Architecture

### Email Bison Integration

**Architecture:**
```
React App → Supabase Edge Function → Email Bison API
     ↑                                        │
     └────────── Webhook ────────────────────┘
```

**Components:**
- `BisonConnector` - API client wrapper
- `bison-interested-webhook` - Webhook handler
- Browser automation for login (if needed)

**Authentication:**
- Workspace API keys
- Stored in `client_registry.bison_api_key`
- Per-workspace credentials

### Clay Integration

**Architecture:**
```
Node Script → Playwright → Clay Website → Clay API
     │                                         │
     └────────── Credentials ─────────────────┘
```

**Components:**
- `ClayConnector` - Browser automation wrapper
- Credentials in `site_credentials` table
- Debounce API integration

### Cole X Dates Integration

**Architecture:**
```
Node Script → Playwright → Cole Website → CSV Export
     │
     └────────── Multi-State Credentials ───┘
```

**Components:**
- `ColeConnector` - Browser automation wrapper
- State-specific credentials (NJ, TX, FL, CA)
- CSV parsing and storage

### Workflow Orchestration

**BullMQ Job Queue:**
```
Workflow Trigger → BullMQ Queue → Worker Process
                                        │
                                        ├─→ PT1: Cole Pulls
                                        ├─→ PT2: Clay Format
                                        ├─→ PT3: Gap Analysis
                                        ├─→ PT4: Bison Upload
                                        └─→ PT5: Campaign Rotation
```

**Components:**
- `orchestrator/queue.ts` - Queue setup
- `orchestrator/scheduler.ts` - Job scheduling
- `workflows/pt*.ts` - Workflow implementations

---

## Authentication & Authorization

### Authentication Flow

**Login Process:**
```
User → Login Page → Supabase Auth → JWT Token → Protected Routes
                                                      │
                                                      └──→ Session Storage
```

**Supabase Auth:**
- Email/password authentication
- PKCE flow for security
- Session refresh tokens
- Password reset via email

### Authorization Model

**Role-Based Access Control (RBAC):**

**Roles:**
- `admin` - Full system access
- `client` - Workspace-specific access
- `viewer` - Read-only workspace access

**Access Control:**
```
User → user_workspace_access → workspace_name → RLS Policy → Data Access
```

**RLS Policies:**
```sql
-- Client leads policy
CREATE POLICY "Users can only see their workspace leads"
ON client_leads FOR SELECT
USING (
  workspace_name IN (
    SELECT workspace_name 
    FROM user_workspace_access 
    WHERE user_id = auth.uid()
  )
)
```

### Workspace Isolation

**Data Filtering:**
- All queries filtered by `workspace_name`
- RLS automatically applies filters
- Admin role bypasses RLS (sees all)

---

## Data Flow Architecture

### Lead Sync Flow

```
Email Bison API
    │
    ├─→ Webhook → bison-interested-webhook → client_leads table
    │
    └─→ Manual Sync → React App → Supabase → client_leads table
```

### KPI Data Flow

```
Email Bison API
    │
    ├─→ Cron Job (daily_kpi_sync) → client_registry updates
    │
    └─→ Manual Refresh → hybrid-workspace-analytics → Dashboard
```

### Contact Pipeline Flow

```
Cole X Dates CSV
    │
    ├─→ Upload → raw_contacts table
    │
    ├─→ Verification → Debounce API → verified_contacts table
    │
    ├─→ Batch Generation → weekly_batches table
    │
    └─→ Upload → Email Bison API → upload_audit_log table
```

### Revenue Calculation Flow

```
client_leads (won) + client_pricing
    │
    ├─→ daily_billable_revenue() function
    │
    └─→ Revenue Dashboard display
```

---

## Workflow Architecture

### PT1: Cole Monthly Pulls

**Architecture:**
```
Scheduler (15th) → BullMQ Job → PT1 Worker
                                      │
                                      ├─→ ColeConnector.connect()
                                      ├─→ ColeConnector.queryData()
                                      ├─→ Store in raw_leads
                                      └─→ Slack notification
```

**Components:**
- `workflows/pt1-cole-pulls.ts`
- `connectors/cole.ts`
- `orchestrator/scheduler.ts`

### PT2: Clay Formatting

**Architecture:**
```
PT1 Completion → BullMQ Job → PT2 Worker
                                      │
                                      ├─→ ClayConnector.format()
                                      ├─→ Debounce verification
                                      ├─→ Store in cleaned_leads
                                      └─→ Slack notification
```

### PT3: Gap Analysis

**Architecture:**
```
PT2 Completion → Gap Analysis
                      │
                      ├─→ Compare: cleaned_count vs target
                      ├─→ If gap: Trigger supplemental PT1
                      └─→ Slack notification
```

### PT4: Email Bison Uploads

**Architecture:**
```
Weekly Schedule (Fridays) → BullMQ Job → PT4 Worker
                                              │
                                              ├─→ Generate CSV
                                              ├─→ BisonConnector.importContacts()
                                              ├─→ Update weekly_batches
                                              └─→ Slack notification
```

### PT5: Campaign Rotation

**Architecture:**
```
After PT4 → BullMQ Job → PT5 Worker
                              │
                              ├─→ BisonConnector.renameCampaign()
                              ├─→ Update campaign status
                              └─→ Slack notification
```

---

## Deployment Architecture

### Frontend Deployment

**Platform:** Lovable/Vercel

**Build Process:**
```
Git Push → CI/CD Pipeline → npm run build → Vite Build → Dist Folder → CDN
```

**Environment Variables:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Deployment Features:**
- Automatic deployments on git push
- Preview deployments for PRs
- Custom domain support

### Backend Deployment

**Platform:** Supabase Cloud

**Database Migrations:**
```
Migration Files → supabase db push → Production Database
```

**Edge Functions:**
```
Function Code → supabase functions deploy → Edge Function Runtime
```

**Environment Variables:**
- Set in Supabase Dashboard
- Encrypted storage
- Per-function isolation

### Automation Deployment

**Platform:** Self-hosted or Cloud Run

**Requirements:**
- Node.js runtime
- Redis connection
- Playwright dependencies
- Environment variables

**Deployment:**
```
Docker Container → Cloud Run / EC2 / Local Server
```

---

## Security Architecture

### Authentication Security

**PKCE Flow:**
- Prevents authorization code interception
- Code verifier/challenge
- Secure token exchange

**Session Management:**
- Secure HTTP-only cookies (Supabase managed)
- Token refresh mechanism
- Automatic logout on expiry

### Data Security

**Row Level Security:**
- Database-level access control
- Workspace isolation
- Role-based policies

**Encryption:**
- Credentials encrypted in `site_credentials`
- HTTPS for all API calls
- Encrypted database connections

### API Security

**Edge Function Security:**
- JWT verification
- Service role key for admin operations
- CORS configuration

**External API Security:**
- API keys stored server-side
- No client-side exposure
- Encrypted credential storage

### Input Validation

**Frontend:**
- Zod schema validation
- React Hook Form validation
- TypeScript type checking

**Backend:**
- Database constraints
- Edge function validation
- SQL injection prevention (parameterized queries)

---

## Monitoring & Logging

### Logging Architecture

**Structured Logging:**
```typescript
logger.info('Operation', { context, metadata })
logger.error('Error', { error, stack, context })
```

**Log Levels:**
- `debug` - Detailed debugging
- `info` - General information
- `warn` - Warnings
- `error` - Errors

**Log Storage:**
- Console output (development)
- File logs (production)
- Database (`agent_errors` table)

### Monitoring

**Health Checks:**
- Email account health scores
- Sync status tracking
- Job queue monitoring

**Alerts:**
- Slack webhook notifications
- Critical account alerts
- Error notifications
- Volume milestone alerts

**Metrics:**
- Dashboard load times
- API response times
- Error rates
- Sync success rates

---

## Performance Architecture

### Frontend Performance

**Code Splitting:**
- Vendor chunks separated
- Route-based lazy loading
- Component lazy loading

**Caching:**
- TanStack Query caching (30 seconds)
- Browser caching
- CDN caching (static assets)

**Optimization:**
- React.memo for expensive components
- useMemo for calculations
- useCallback for event handlers
- Virtualization for long lists

### Backend Performance

**Database Optimization:**
- Strategic indexes
- Query optimization
- Connection pooling (Supabase managed)
- Materialized views (if needed)

**API Optimization:**
- Edge function caching
- Batch operations
- Pagination for large datasets
- Response compression

### Scalability

**Horizontal Scaling:**
- Stateless edge functions
- Database connection pooling
- Redis for distributed queues

**Vertical Scaling:**
- Supabase auto-scaling
- CDN for static assets
- Load balancing (managed)

---

## Development Environment

### Local Setup

**Requirements:**
- Node.js 18+
- Docker Desktop (Supabase local)
- Supabase CLI
- Redis (local or cloud)

**Local Development:**
```bash
# Start Supabase locally
supabase start

# Start frontend dev server
npm run dev

# Run workflows locally
npm run agent:dev
```

### Environment Variables

**Frontend (.env.local):**
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=local-anon-key
```

**Backend (Supabase Dashboard):**
```
ANTHROPIC_API_KEY=...
SLACK_WEBHOOK_URL=...
BISON_API_KEY=...
```

**Automation (.env):**
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://localhost:6379
COLE_NJ_USERNAME=...
COLE_NJ_PASSWORD=...
CLAY_EMAIL=...
CLAY_PASSWORD=...
BISON_EMAIL=...
BISON_PASSWORD=...
```

---

## Testing Architecture

### Frontend Testing

**Testing Tools:**
- Vitest - Unit testing
- Playwright - E2E testing
- React Testing Library - Component testing

**Test Types:**
- Unit tests for utilities
- Component tests for UI
- E2E tests for workflows

### Backend Testing

**Testing Tools:**
- Supabase local instance
- tsx for script testing
- Manual API testing

**Test Types:**
- Connector tests (Cole, Clay, Bison)
- Workflow tests (PT1-PT5)
- Edge function tests

---

## Error Handling Architecture

### Frontend Error Handling

**Error Boundaries:**
- React Error Boundary component
- Catch React errors
- Display fallback UI

**API Error Handling:**
- Try-catch blocks
- Error toast notifications
- Retry logic (TanStack Query)

### Backend Error Handling

**Edge Function Errors:**
- Try-catch blocks
- Structured error responses
- Error logging

**Database Errors:**
- Constraint violations handled
- Transaction rollback
- Error propagation

**Workflow Errors:**
- Error tracking in `agent_errors`
- Screenshot capture
- Slack notifications
- Retry logic (BullMQ)

---

## Data Migration Architecture

### Migration System

**Supabase Migrations:**
- SQL migration files
- Version-controlled
- Sequential execution
- Rollback support

**Migration Pattern:**
```
20251003150000_create_client_leads.sql
20251003160000_add_bison_reply_id.sql
20251003170000_add_interested_flag.sql
```

### Data Migration

**Airtable → Supabase:**
- One-time migration scripts
- Data transformation
- Validation checks
- Audit trail

---

## Backup & Recovery

### Database Backups

**Supabase Managed:**
- Daily automated backups
- Point-in-time recovery
- Backup retention

### Data Export

**Manual Exports:**
- CSV exports via UI
- SQL dumps via Supabase Dashboard
- Programmatic exports via Edge Functions

---

## API Documentation

### Supabase Client API

**Auto-Generated Docs:**
- PostgREST API docs
- Table schemas
- Query examples

### Edge Function APIs

**Function Documentation:**
- JSDoc comments
- Type definitions
- Usage examples

---

## Configuration Management

### Environment Configuration

**Frontend:**
- Vite environment variables
- `.env.local` for local
- `.env.production` for production

**Backend:**
- Supabase Dashboard settings
- Edge function secrets
- Database configuration

### Feature Flags

**Potential Implementation:**
- Database-based flags
- Environment variables
- Conditional feature rendering

---

## Future Architecture Considerations

### Scalability Improvements

- **Caching Layer:** Redis for frequently accessed data
- **CDN:** Static asset CDN
- **Database Replication:** Read replicas for analytics
- **Queue Workers:** Separate worker instances

### Performance Improvements

- **GraphQL:** Alternative to REST API
- **WebSockets:** Real-time updates via WebSockets
- **Service Workers:** Offline support
- **Image Optimization:** CDN with image optimization

### Architecture Evolution

- **Microservices:** Separate services for different domains
- **Event Streaming:** Kafka for event-driven architecture
- **API Gateway:** Centralized API management
- **Container Orchestration:** Kubernetes for automation

---

**End of Technical Architecture Document**
