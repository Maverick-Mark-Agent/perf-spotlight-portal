# Homeowner Agent Automation System

## Overview

Automated workflow system for managing B2C homeowner insurance lead generation, processing, and campaign management across Cole X Dates, Clay, and Email Bison platforms.

## Architecture

### Workflows (PT1-PT5)

1. **PT1 - Cole Monthly Pulls** (15th of month)
   - Pulls homeowner data from Cole X Dates
   - Multi-state support (NJ, TX, FL, CA)
   - Automatic <10k chunking
   - Saves to `raw_leads` and `client_zipcodes` tables

2. **PT2 - Clay Formatting & Enrichment**
   - Imports raw leads to Clay
   - Adds derived columns (Numeric Home Value, Readable Purchase Date, Purchase Day)
   - Runs Debounce email validation
   - Applies filters (Head of Household, Home Value ≤ $900k, safe emails)
   - Exports cleaned data

3. **PT3 - Gap Analysis**
   - Compares cleaned count vs target
   - Calculates gap
   - Triggers additional pulls if needed

4. **PT4 - Weekly Bison Uploads** (Fridays)
   - Imports contacts to Email Bison
   - Adds to campaigns
   - Field mapping

5. **PT5 - Evergreen Campaign Updates**
   - Renames campaigns
   - Manages Evergreen rotation

### Tech Stack

- **Browser Automation**: Playwright
- **Job Orchestration**: BullMQ + Redis
- **Database**: Supabase (PostgreSQL)
- **Notifications**: Slack webhooks
- **Error Tracking**: Structured logging + agent_errors table
- **CI/CD**: GitHub Actions

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in:

```bash
# Supabase
SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key
SUPABASE_ANON_KEY=your-anon-key

# Redis
REDIS_URL=redis://localhost:6379

# Cole X Dates (per state)
COLE_NJ_USERNAME=username
COLE_NJ_PASSWORD=password
# ... repeat for TX, FL, CA

# Clay
CLAY_EMAIL=email
CLAY_PASSWORD=password

# Email Bison
BISON_EMAIL=email
BISON_PASSWORD=password

# Slack
SLACK_WEBHOOK_URL=webhook-url
```

### 3. Run Migrations

```bash
# Run migrations via Supabase dashboard
# See supabase/migrations/*.sql
```

### 4. Seed Credentials

```bash
npm run seed:credentials
```

## Usage

### Testing Connectors

```bash
# Cole
npm run test:cole-login
npm run test:cole-dry-run

# Clay
npm run test:clay-login
npm run test:clay-workflow

# Bison
npm run test:bison-login
npm run test:bison-import
```

### Testing Workflows

```bash
npm run test:pt1
```

### Running Workflows

```bash
# Start BullMQ workers
npx tsx src/orchestrator/queue.ts

# Schedule workflows
npx tsx src/orchestrator/scheduler.ts
```

## Database Schema

### Key Tables

- **`agent_runs`**: Workflow execution tracking
- **`agent_errors`**: Error logging with screenshots/traces
- **`raw_leads`**: Unprocessed leads from Cole
- **`cleaned_leads`**: Processed, validated leads
- **`client_zipcodes`**: ZIP code tracking by client/month
- **`monthly_cleaned_leads`**: Monthly totals with gap calculation
- **`site_credentials`**: Encrypted credentials storage

## Credential Rotation

See `docs/runbooks/credential-rotation.md` for rotating credentials every 90 days.

## Error Handling

- Automatic retry with exponential backoff
- Screenshot capture on failures
- Playwright trace recording
- Slack notifications
- Persisted to `agent_errors` table

## Monitoring

- Structured JSON logging
- Agent run tracking
- Error escalation system
- Slack notifications

## Development

### Type Checking

```bash
npm run validate:types
```

### Validating Secrets

```bash
npm run validate:secrets
```

### Running Tests

```bash
npm run test:pipeline
npm run test:all
```

## Support

For issues or questions, see the rollout documentation in `/docs/rollout/`.
