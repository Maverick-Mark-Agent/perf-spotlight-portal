#!/bin/bash

echo "Deploying email_accounts_raw and email_accounts_view tables..."

export SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015"

cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"

# Deploy just the new migration
npx supabase db push --include-all --file supabase/migrations/20251009220000_create_email_accounts_tables.sql

echo "Migration deployed successfully!"
