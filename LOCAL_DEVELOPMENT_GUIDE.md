# Local Development Setup Guide

This guide will help you set up a complete local development environment where you can make and test changes before deploying to production.

---

## Overview

**Goal:** Create a local copy of the dashboard that:
1. Runs on your machine (http://localhost:8080)
2. Uses a local Supabase instance (http://localhost:54321)
3. Has its own isolated database
4. Allows you to test changes without affecting production
5. Can be pushed to production when ready

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** ([download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Docker Desktop** ([download](https://www.docker.com/products/docker-desktop/))
- **Supabase CLI** (we'll install this)
- **Git** (for version control)

---

## Step 1: Verify Prerequisites

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version
npm --version

# Check Docker is running
docker --version
docker ps  # Should show running containers or empty list
```

If any command fails, install the missing prerequisite.

---

## Step 2: Install Supabase CLI

```bash
# Install Supabase CLI globally
npm install -g supabase

# Verify installation
supabase --version
```

---

## Step 3: Project Setup

```bash
# Navigate to your project directory
cd /Users/mac/Downloads/perf-spotlight-portal

# Install all dependencies
npm install

# This will install:
# - React, TypeScript, Vite
# - Supabase client
# - UI components (Shadcn)
# - All other dependencies
```

---

## Step 4: Initialize Local Supabase

```bash
# Initialize Supabase in your project (if not already done)
supabase init

# This creates a supabase/ directory with:
# - config.toml (Supabase configuration)
# - migrations/ (database schema)
# - functions/ (Edge Functions)
```

**Note:** If `supabase/` directory already exists, this step is already done!

---

## Step 5: Start Local Supabase

```bash
# Start local Supabase (requires Docker to be running)
supabase start

# ⏳ First time will take 2-5 minutes (downloads Docker images)
# Subsequent starts will be faster (<30 seconds)
```

**Expected Output:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
 service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

**Save these values!** You'll need them for the next step.

---

## Step 6: Configure Environment Variables

Create a new file `.env.local` (this is for local development only):

```bash
# Create .env.local
touch .env.local
```

Edit `.env.local` and add:

```env
# ===========================================
# LOCAL DEVELOPMENT ENVIRONMENT
# ===========================================

# Use local Supabase instance
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Service role key (for Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Email Bison API (use test credentials or production read-only)
EMAIL_BISON_API_KEY=your-email-bison-api-key-here

# Optional: Redis for job queues (not needed for dashboard viewing)
REDIS_URL=redis://localhost:6379
```

**Important:**
- Replace the `anon key` and `service_role key` with the actual values from `supabase start` output
- The `VITE_` prefix is required for Vite to expose variables to the frontend
- `.env.local` is already in `.gitignore` so it won't be committed

---

## Step 7: Apply Database Migrations

This will create all tables, functions, and policies in your local database:

```bash
# Apply all migrations
supabase db reset

# This will:
# 1. Drop existing local database (if any)
# 2. Apply all migrations from supabase/migrations/
# 3. Create all tables, indexes, functions
# 4. Set up RLS policies
```

**Expected Output:**
```
Applying migration 20251003000000_create_email_account_metadata.sql...
Applying migration 20251003150000_create_client_leads.sql...
Applying migration 20251005180000_create_client_registry.sql...
... (50+ migrations)
✅ All migrations applied successfully
```

---

## Step 8: Seed Test Data (Optional)

For local testing, you may want to add some test data:

```bash
# Open Supabase Studio (local web interface)
open http://localhost:54323
```

In the SQL Editor, run:

```sql
-- Add a test client
INSERT INTO client_registry (
  workspace_id,
  workspace_name,
  display_name,
  is_active,
  billing_type,
  monthly_kpi_target,
  monthly_sending_target,
  payout
) VALUES (
  99999,
  'Test Client',
  'Test Client Display Name',
  true,
  'per_lead',
  50,
  10000,
  0.0
);

-- Add some test leads
INSERT INTO client_leads (
  airtable_id,
  workspace_name,
  client_name,
  lead_email,
  first_name,
  last_name,
  date_received,
  pipeline_stage,
  lead_value
) VALUES
  ('test-lead-1', 'Test Client', 'Test Client', 'lead1@example.com', 'John', 'Doe', NOW(), 'new', 500),
  ('test-lead-2', 'Test Client', 'Test Client', 'lead2@example.com', 'Jane', 'Smith', NOW(), 'follow-up', 500);

-- Verify data
SELECT * FROM client_registry;
SELECT * FROM client_leads;
```

---

## Step 9: Start Development Server

```bash
# Start the Vite development server
npm run dev

# Expected output:
#   VITE v5.4.19  ready in 500 ms
#   ➜  Local:   http://localhost:8080/
#   ➜  Network: use --host to expose
```

Open your browser to **http://localhost:8080**

---

## Step 10: Verify Everything Works

1. **Homepage loads** - You should see the dashboard homepage
2. **Supabase connection** - Check browser console for errors
3. **Data loads** - Navigate to KPI Dashboard, Email Accounts, etc.
4. **Local database** - Verify data from your local Supabase appears

---

## Development Workflow

### Making Changes

#### Frontend Changes (React/TypeScript)

1. Edit files in `src/` directory
2. Vite will hot-reload automatically
3. Check browser for changes
4. Fix any TypeScript errors

Example:
```bash
# Edit a component
code src/pages/KPIDashboard.tsx

# Vite automatically reloads
# Check http://localhost:8080/kpi-dashboard
```

#### Database Changes (Migrations)

1. Create a new migration:
```bash
supabase migration new your_migration_name

# Creates: supabase/migrations/YYYYMMDD_your_migration_name.sql
```

2. Edit the migration file:
```sql
-- Example: Add a new column
ALTER TABLE client_registry
ADD COLUMN new_field TEXT;
```

3. Apply the migration:
```bash
supabase db reset
# Or for incremental: supabase db push
```

#### Edge Function Changes

1. Edit function in `supabase/functions/your-function/index.ts`

2. Serve locally:
```bash
supabase functions serve your-function --env-file .env.local
```

3. Test with:
```bash
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/your-function' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

### Testing Changes

```bash
# Run TypeScript type checking
npm run validate:types

# Run linter
npm run lint

# Build for production (test for build errors)
npm run build

# Preview production build
npm run preview
```

---

## Deploying to Production

Once you're happy with your local changes, deploy to production:

### Step 1: Commit Your Changes

```bash
# Stage all changes
git add .

# Commit with a descriptive message
git commit -m "feat: Add new dashboard feature"

# Push to GitHub
git push origin main
```

### Step 2: Deploy Database Changes

```bash
# Link to production project (first time only)
supabase link --project-ref gjqbbgrfhijescaouqkx

# Push new migrations to production
supabase db push

# ⚠️ WARNING: This will modify production database!
# Make sure you've tested locally first!
```

### Step 3: Deploy Edge Functions

```bash
# Deploy a specific function
supabase functions deploy hybrid-email-accounts-v2

# Or deploy all functions
for func in supabase/functions/*/; do
  func_name=$(basename "$func")
  echo "Deploying $func_name..."
  supabase functions deploy "$func_name"
done
```

### Step 4: Deploy Frontend

The frontend is automatically deployed by Netlify when you push to GitHub:

1. Push to `main` branch
2. Netlify detects the push
3. Runs `npm run build`
4. Deploys to production
5. Check deployment status at [Netlify Dashboard](https://app.netlify.com/)

**Production URL:** Will be displayed in Netlify dashboard

---

## Switching Between Local and Production

### Use Local Supabase

Edit `.env.local`:
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

### Test Against Production (Read-Only)

Edit `.env.local`:
```env
VITE_SUPABASE_URL=https://gjqbbgrfhijescaouqkx.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

**⚠️ Be careful!** This connects your local frontend to production data. Don't modify data unless you're sure!

---

## Common Issues & Solutions

### Issue: `supabase start` fails

**Solution:**
```bash
# Make sure Docker is running
docker ps

# If Docker isn't running, start Docker Desktop
# Then try again:
supabase start
```

### Issue: Port already in use

**Solution:**
```bash
# Stop Supabase
supabase stop

# Start again
supabase start
```

### Issue: Migrations fail to apply

**Solution:**
```bash
# Check migration file for syntax errors
code supabase/migrations/YYYYMMDD_migration_name.sql

# Reset database and try again
supabase db reset
```

### Issue: Frontend can't connect to Supabase

**Solution:**
1. Verify `.env.local` has correct values
2. Restart dev server: `npm run dev`
3. Check browser console for errors
4. Verify Supabase is running: `supabase status`

### Issue: Edge Function not working

**Solution:**
```bash
# Check function logs
supabase functions logs your-function

# Serve locally for debugging
supabase functions serve your-function --env-file .env.local

# Check environment variables
supabase secrets list
```

---

## Useful Commands

```bash
# Supabase
supabase start           # Start local Supabase
supabase stop            # Stop local Supabase
supabase status          # Check status
supabase db reset        # Reset database and apply migrations
supabase db push         # Push schema changes to remote
supabase functions serve # Serve Edge Functions locally

# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run linter
npm run validate:types   # TypeScript type checking

# Database
supabase migration new   # Create new migration
supabase db diff         # Show schema differences

# Studio (Web UI)
open http://localhost:54323  # Open Supabase Studio
```

---

## Project Structure

```
perf-spotlight-portal/
├── src/
│   ├── pages/              # Dashboard pages
│   │   ├── KPIDashboard.tsx
│   │   ├── EmailAccountsPage.tsx
│   │   └── ...
│   ├── services/           # Data fetching services
│   │   ├── dataService.ts
│   │   └── realtimeDataService.ts
│   ├── components/         # Reusable components
│   └── lib/                # Utilities
├── supabase/
│   ├── functions/          # Edge Functions (63 total)
│   │   ├── hybrid-email-accounts-v2/
│   │   ├── hybrid-workspace-analytics/
│   │   └── ...
│   ├── migrations/         # Database migrations (51 total)
│   └── config.toml         # Supabase configuration
├── .env.local              # Local environment variables (DO NOT COMMIT)
├── .env                    # Production environment variables
├── package.json            # Dependencies
├── vite.config.ts          # Vite configuration
└── README.md               # Project documentation
```

---

## Next Steps

Now that you have a local development environment:

1. **Explore the codebase** - Read `SYSTEM_ARCHITECTURE.md` to understand how everything works
2. **Make a small change** - Try modifying a component or adding a new field
3. **Test locally** - Verify your changes work in local environment
4. **Deploy to production** - Push your changes when ready

---

## Support

If you run into issues:

1. Check this guide first
2. Review `SYSTEM_ARCHITECTURE.md` for system details
3. Check browser console for errors
4. Check Supabase logs: `supabase logs`
5. Check Edge Function logs in Supabase Dashboard

---

**Happy Coding! 🚀**
