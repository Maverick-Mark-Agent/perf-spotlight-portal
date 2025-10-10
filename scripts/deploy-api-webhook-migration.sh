#!/bin/bash

# Deploy API & Webhook Management Migration
# This script deploys ONLY the new migration via Supabase Management API

set -e

ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015"
PROJECT_REF="gjqbbgrfhijescaouqkx"

echo "🚀 Deploying API & Webhook Management Migration..."
echo ""

# Read the SQL migration file
MIGRATION_SQL=$(cat "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/supabase/migrations/20251010000000_add_api_webhook_management.sql")

# Execute the migration via Supabase Management API
echo "📡 Executing SQL migration via Supabase API..."
RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$MIGRATION_SQL" | jq -Rs .)}")

echo "$RESPONSE" | jq '.'

# Check for errors
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo ""
  echo "❌ Migration failed with error:"
  echo "$RESPONSE" | jq -r '.error'
  exit 1
fi

echo ""
echo "✅ Migration deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Generate Workspark API key in Email Bison dashboard"
echo "2. Add key to client_registry table"
echo "3. Deploy sync-email-accounts-v2 Edge Function"
