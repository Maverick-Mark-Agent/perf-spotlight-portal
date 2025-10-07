# 🚀 Deployment Setup Guide

## Current Status

✅ Code complete (all 20 phases)
✅ Tests passing
✅ Environment partially configured
❌ Need real Supabase service role key
❌ Need database migrations
❌ Need real platform credentials (Cole, Clay, Bison)

## Step 1: Get Supabase Service Role Key

1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/api
2. Scroll to "Project API keys"
3. Copy the **service_role** key (NOT the anon key)
4. Update `.env` file:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...  # paste the real key
   ```

## Step 2: Run Database Migrations

Since Docker/local Supabase isn't running, use SQL Editor:

1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/editor
2. Run these migrations in order:

### Migration 1: Agent Tables
```sql
-- Copy content from: supabase/migrations/20251005200000_create_agent_tables.sql
```

### Migration 2: Client Zipcodes
```sql
-- Copy content from: supabase/migrations/20251005203000_create_client_zipcodes.sql
```

### Migration 3: Monthly Cleaned Leads
```sql
-- Copy content from: supabase/migrations/20251005203100_create_monthly_cleaned_leads.sql
```

## Step 3: Verify Database Setup

```bash
npx tsx scripts/test-db-connection.ts
```

Should show all agent tables exist.

## Step 4: Get Platform Credentials

### Cole X Dates
- Login at: https://coleinformation.com
- Get credentials for states you need (NJ, TX, FL, CA)
- Update `.env`:
  ```
  COLE_NJ_USERNAME=your-username
  COLE_NJ_PASSWORD=your-password
  ```

### Clay
- Login at: https://clay.com
- Update `.env`:
  ```
  CLAY_EMAIL=your-email
  CLAY_PASSWORD=your-password
  ```

### Email Bison
- Login at: https://emailbison.com
- Update `.env`:
  ```
  BISON_EMAIL=your-email
  BISON_PASSWORD=your-password
  ```

### Slack
- Create webhook at: https://api.slack.com/messaging/webhooks
- Update `.env`:
  ```
  SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
  ```

## Step 5: Seed Credentials

```bash
npm run seed:credentials
```

## Step 6: Test Connectors

```bash
# Test with headless=false to see browser
HEADLESS=false npm run test:cole-login
HEADLESS=false npm run test:clay-login
HEADLESS=false npm run test:bison-login
```

## Step 7: Start Debugging

If tests fail:
1. Browser will open (HEADLESS=false)
2. Check selectors in connector files
3. Look at screenshots in `downloads/` folder
4. Check logs (JSON structured logging)

## Quick Start Once Configured

```bash
# Start Redis (for BullMQ)
redis-server

# Start workers
npx tsx src/orchestrator/queue.ts

# In another terminal, schedule jobs
npx tsx src/orchestrator/scheduler.ts

# Or run workflows manually
npm run test:pt1
```

## Need Help?

Check:
- `docs/AGENT_README.md` - Full system docs
- `docs/TEST_RESULTS.md` - Test status
- `docs/runbooks/credential-rotation.md` - Security guide
- `docs/rollout/` - Phase-by-phase guides
