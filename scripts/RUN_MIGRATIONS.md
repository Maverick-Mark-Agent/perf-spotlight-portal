# 🚀 Run Database Migrations

## Quick Instructions

1. Go to Supabase SQL Editor:
   **https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new**

2. Run these 3 migrations in order:

### Migration 1: Agent Tables (MAIN)
Copy and paste the entire contents of:
`supabase/migrations/20251005200000_create_agent_tables.sql`

Click "Run" - this creates all 10 agent tables.

### Migration 2: Client Zipcodes
Copy and paste the entire contents of:
`supabase/migrations/20251005203000_create_client_zipcodes.sql`

Click "Run"

### Migration 3: Monthly Cleaned Leads
Copy and paste the entire contents of:
`supabase/migrations/20251005203100_create_monthly_cleaned_leads.sql`

Click "Run"

## Verify

After running, come back and run:
```bash
npx tsx scripts/test-db-connection.ts
```

All tables should show ✅

## Tables Created

1. agent_runs - Workflow execution tracking
2. lead_sources - Data pull configuration
3. raw_leads - Unprocessed scraped data
4. cleaned_leads - Normalized & validated leads
5. client_lead_batches - Weekly upload batches
6. site_credentials - Credential storage
7. agent_errors - Error tracking with screenshots
8. batch_lead_assignments - Lead-to-batch mapping
9. client_zipcodes - ZIP tracking per month
10. monthly_cleaned_leads - Monthly totals & gap analysis

All with RLS (Row Level Security) enabled and proper indexes!
