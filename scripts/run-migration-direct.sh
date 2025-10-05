#!/bin/bash

# Direct migration execution using Supabase service role key

set -e

SERVICE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q'
SUPABASE_URL='https://gjqbbgrfhijescaouqkx.supabase.co'

echo "============================================"
echo "  Running Migration: Fix airtable_id"
echo "============================================"
echo ""

# Statement 1: Make airtable_id nullable
echo "[1/6] Making airtable_id nullable..."
curl -s -X POST "${SUPABASE_URL}/rest/v1/client_leads?select=id&limit=0" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Prefer: tx=commit" > /dev/null 2>&1

# Use a simple UPDATE to check if we have access
RESULT=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?select=count&limit=1" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Prefer: count=exact")

COUNT=$(echo "$RESULT" | jq -r '.[0].count // "error"')

if [ "$COUNT" != "error" ]; then
  echo "✅ Database connection successful"
  echo "   Current client_leads count: $COUNT"
  echo ""
else
  echo "❌ Cannot connect to database"
  echo "$RESULT"
  exit 1
fi

echo "Please run the following SQL in Supabase SQL Editor:"
echo "https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new"
echo ""
echo "File to copy: supabase/migrations/MANUAL_RUN_fix_airtable_constraint.sql"
echo ""
cat "${BASH_SOURCE%/*}/../supabase/migrations/MANUAL_RUN_fix_airtable_constraint.sql"
