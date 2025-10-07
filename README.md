# Performance Spotlight Portal

A comprehensive client analytics and automation platform for Maverick Marketing LLC, combining real-time KPI dashboards, client lead management, and automated homeowner insurance lead generation workflows.

## Overview

This platform provides:

1. **Client Analytics Dashboards** - Real-time KPIs, volume tracking, revenue analysis, and ROI metrics
2. **Client Portal System** - Individual portals for 18+ clients with lead pipeline management
3. **Email Bison Integration** - Direct API integration with webhook-based real-time lead sync
4. **ZIP Code Management** - Interactive map visualization for ZIP code assignments
5. **Automated Lead Generation** - Browser automation workflows for B2C homeowner insurance leads

**Live Portal**: https://perf-spotlight-portal.lovable.app

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn-ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Automation**: Playwright + BullMQ + Redis
- **Integrations**: Email Bison API, Clay API, Cole X Dates
- **Monitoring**: Slack webhooks, structured logging

### Data Flow
```
Email Bison API ──webhook──> Supabase ──edge functions──> React Dashboard
                     ↑                                           ↓
                     └──────── Direct API calls ─────────────────┘

Cole X Dates ──browser automation──> Raw Leads ──> Clay ──> Cleaned Leads ──> Email Bison
```

## Quick Start

### Prerequisites
- Node.js 18+ (install with [nvm](https://github.com/nvm-sh/nvm))
- Redis (for BullMQ job queues)
- Supabase account and project
- Email Bison, Clay, and Cole X Dates accounts

### Installation

```bash
# Clone repository
git clone <repository-url>
cd perf-spotlight-portal

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
# See scripts/RUN_MIGRATIONS.md

# Seed credentials
npm run seed:credentials

# Start development server
npm run dev
```

### Environment Variables

Required in `.env`:
```bash
# Supabase
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# Redis (for automation workflows)
REDIS_URL=redis://localhost:6379

# Email Bison
BISON_EMAIL=your-email
BISON_PASSWORD=your-password

# Cole X Dates (per state: NJ, TX, FL, CA)
COLE_NJ_USERNAME=username
COLE_NJ_PASSWORD=password

# Clay
CLAY_EMAIL=your-email
CLAY_PASSWORD=your-password
CLAY_API_KEY=your-api-key

# Slack notifications
SLACK_WEBHOOK_URL=your-webhook-url

# Automation settings
HEADLESS=false  # Set to true for production
LOG_LEVEL=debug
```

## Key Features

### 1. Client Portal System
Individual portals for each client showing:
- Real-time lead pipeline (New → Interested → Positive Reply → Closed)
- Direct links to Email Bison conversations
- Lead stage management
- Monthly performance metrics

**Routes**:
- `/client-portal` - Hub with all clients
- `/client-portal/:workspace` - Individual client portal

### 2. Analytics Dashboards

**KPI Dashboard** (`/kpi-dashboard`)
- Positive replies, appointments booked, policies sold
- Email Bison API integration for real-time metrics
- Month-over-month comparison

**Volume Dashboard** (`/volume-dashboard`)
- Daily lead volume tracking
- Slack notifications for volume milestones

**Revenue Dashboard** (`/revenue-dashboard`)
- Commission tracking per client
- Monthly revenue analysis

**ROI Dashboard** (`/roi-dashboard`)
- Cost per acquisition
- Return on ad spend

### 3. ZIP Code Management

**ZIP Dashboard** (`/zip-dashboard`)
- Interactive Plotly.js choropleth map
- ZIP code assignment by month and agency
- Agency color-coding with visual legend
- State-specific GeoJSON visualization (CA, NV, TX, MI, IL, OR, MO, OK)

### 4. Automated Lead Generation

**Homeowner Workflows** (PT1-PT5)

1. **PT1**: Monthly data pulls from Cole X Dates (15th of month)
   - Multi-state support (NJ, TX, FL, CA)
   - Automatic chunking for <10k records
   - Saves to `raw_leads` table

2. **PT2**: Clay formatting and enrichment
   - Email validation via Debounce
   - Home value filtering (≤$900k)
   - Head of household filtering

3. **PT3**: Gap analysis and additional pulls
   - Compares cleaned count vs target
   - Triggers supplemental pulls if needed

4. **PT4**: Weekly Email Bison uploads (Fridays)
   - Imports contacts to campaigns
   - Field mapping and tagging

5. **PT5**: Evergreen campaign rotation
   - Campaign renaming
   - Automated rotation management

**See**: [docs/AGENT_README.md](docs/AGENT_README.md) for full workflow documentation

## Scripts

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm run preview                # Preview production build

# Type checking & validation
npm run validate:types         # TypeScript type checking
npm run validate:secrets       # Verify all credentials configured
npm run validate:all           # Run all validations

# Testing connectors
npm run test:cole-login        # Test Cole X Dates login
npm run test:clay-login        # Test Clay login
npm run test:bison-login       # Test Email Bison login

# Testing workflows
npm run test:pt1               # Test PT1 workflow (Cole pulls)
npm run test:pipeline          # Test lead pipeline
npm run test:all               # Run all Playwright tests

# Automation workflows
npm run agent:dev              # Run agent workflows in dev mode
npm run agent:run              # Run specific agent workflow

# Database
npm run types:generate         # Generate Supabase types
npm run seed:credentials       # Seed encrypted credentials
```

## Database Schema

**Lead Management:**
- `client_leads` - All leads from Email Bison with pipeline stages
- `raw_leads` - Unprocessed leads from Cole X Dates
- `cleaned_leads` - Validated, enriched leads
- `monthly_cleaned_leads` - Monthly totals with gap analysis

**Configuration:**
- `client_zipcodes` - ZIP assignments by client/month
- `site_credentials` - Encrypted credentials for automation
- `agent_runs` - Workflow execution tracking
- `agent_errors` - Error logging with screenshots/traces

**See**: [supabase/migrations/](supabase/migrations/) for full schema

## Deployment

### Via Lovable
1. Visit [Lovable Project](https://lovable.dev/projects/ad87c4b8-0b3a-44f0-89e7-c815e1d9f5ad)
2. Click Share → Publish

### Manual Deployment
```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

### Custom Domain
Navigate to Project > Settings > Domains in Lovable dashboard

## Documentation

### Core Documentation
- [AGENT_README.md](docs/AGENT_README.md) - Automation workflows (PT1-PT5)
- [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) - Current deployment status
- [RUN_MIGRATIONS.md](scripts/RUN_MIGRATIONS.md) - Database migration guide

### Migration & Infrastructure
- [COMPREHENSIVE_MIGRATION_REPORT.md](COMPREHENSIVE_MIGRATION_REPORT.md) - Airtable to Supabase migration
- [infrastructure-airtable-to-supabase-migration.md](docs/infrastructure-airtable-to-supabase-migration.md) - Infrastructure changes

### Email Bison Integration
- [WEBHOOK_STATUS.md](docs/WEBHOOK_STATUS.md) - Webhook configuration status
- [EMAIL_BISON_API_REFERENCE.md](docs/EMAIL_BISON_API_REFERENCE.md) - API reference

### Runbooks
- [credential-rotation.md](docs/runbooks/credential-rotation.md) - Credential rotation procedures
- [WEBHOOK_VERIFICATION.md](docs/runbooks/WEBHOOK_VERIFICATION.md) - Webhook verification guide
- [WORKSPACE_AUDIT.md](docs/runbooks/WORKSPACE_AUDIT.md) - Workspace audit procedures

### SOPs & Guides
- [home-insurance-campaign-sop.md](docs/home-insurance-campaign-sop.md) - Campaign management SOP
- [zip-dashboard-guide.md](docs/zip-dashboard-guide.md) - ZIP dashboard usage guide

## Project Structure

```
perf-spotlight-portal/
├── src/
│   ├── agents/          # Browser automation (Playwright)
│   ├── connectors/      # Cole, Clay, Email Bison integrations
│   ├── workflows/       # PT1-PT5 automated workflows
│   ├── orchestrator/    # BullMQ job queue management
│   ├── pipeline/        # Lead processing (normalize, validate, dedupe)
│   ├── pages/           # React pages/routes
│   ├── components/      # React components
│   └── lib/             # Utilities (logger, errors, secrets, slack)
├── supabase/
│   └── migrations/      # Database migrations
├── scripts/             # Maintenance and testing scripts
├── tests/               # Playwright tests
└── docs/                # Documentation
```

## Support & Contributing

**Issues**: Report bugs via GitHub Issues
**Questions**: See documentation in `/docs/`
**Lovable**: Make changes via [Lovable dashboard](https://lovable.dev/projects/ad87c4b8-0b3a-44f0-89e7-c815e1d9f5ad)

## License

Proprietary - Maverick Marketing LLC
