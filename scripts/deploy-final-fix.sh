#!/bin/bash

# Deploy the FINAL_FIX.sql to Supabase using psql
PGPASSWORD="Maverick2024!" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.gjqbbgrfhijescaouqkx \
  -d postgres \
  -f "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/FINAL_FIX.sql"

echo ""
echo "✅ SQL has been executed!"
echo ""
echo "Testing the fix..."
