#!/bin/bash

# Check Supabase pg_cron status via different methods
# This script attempts to verify if the cron job is scheduled

set -e

PROJECT_REF="gjqbbgrfhijescaouqkx"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

echo "======================================================================"
echo "SUPABASE CRON JOB ACCESS CHECK"
echo "======================================================================"
echo ""

# Method 1: Check via REST API (cron.job table)
echo "Method 1: Checking cron.job via REST API..."
echo "----------------------------------------------------------------------"
curl -s "${SUPABASE_URL}/rest/v1/cron.job?select=*&jobname=eq.daily-kpi-metrics-sync" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  | jq '.' 2>&1 || echo "❌ Cannot access cron.job table"
echo ""

# Method 2: Check via RPC call to exec_sql
echo "Method 2: Checking via exec_sql RPC..."
echo "----------------------------------------------------------------------"
curl -s "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query_text": "SELECT * FROM cron.job WHERE jobname = '\''daily-kpi-metrics-sync'\''"}' \
  | jq '.' 2>&1 || echo "❌ exec_sql RPC not available or no access"
echo ""

# Method 3: Check pg_extension for pg_cron
echo "Method 3: Checking pg_extension for pg_cron..."
echo "----------------------------------------------------------------------"
curl -s "${SUPABASE_URL}/rest/v1/pg_extension?select=extname,extversion&extname=eq.pg_cron" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  | jq '.' 2>&1 || echo "❌ Cannot access pg_extension table"
echo ""

# Method 4: List all available tables/views in public schema
echo "Method 4: Checking what tables are accessible..."
echo "----------------------------------------------------------------------"
echo "Attempting to list accessible tables (this may fail)..."
curl -s "${SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  | jq '.' 2>&1 | head -20 || echo "❌ Cannot list tables"
echo ""

# Method 5: Check if Supabase CLI can help
echo "Method 5: Checking Supabase CLI capabilities..."
echo "----------------------------------------------------------------------"
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI is installed"
    supabase --version
    echo ""
    echo "Note: To check cron jobs, you would need to:"
    echo "  1. Link to your project: supabase link --project-ref ${PROJECT_REF}"
    echo "  2. Use db commands: supabase db dump --schema cron"
else
    echo "❌ Supabase CLI not found (but npx supabase is available)"
fi
echo ""

echo "======================================================================"
echo "SUMMARY"
echo "======================================================================"
echo ""
echo "To verify if the cron job is scheduled, you need to either:"
echo ""
echo "1. Use Supabase Dashboard SQL Editor:"
echo "   - Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
echo "   - Run: SELECT * FROM cron.job WHERE jobname = 'daily-kpi-metrics-sync';"
echo ""
echo "2. Use psql with database credentials:"
echo "   - Command: PGPASSWORD='...' psql -h aws-0-us-west-1.pooler.supabase.com -p 6543 -U postgres.${PROJECT_REF} -d postgres"
echo "   - Query: SELECT * FROM cron.job WHERE jobname = 'daily-kpi-metrics-sync';"
echo ""
echo "3. Check migration history:"
echo "   - Run: SELECT * FROM supabase_migrations.schema_migrations WHERE version = '20251009235900';"
echo ""
echo "======================================================================"
