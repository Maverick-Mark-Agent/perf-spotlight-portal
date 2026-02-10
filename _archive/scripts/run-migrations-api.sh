#!/bin/bash

# Run migrations via Supabase Management API
set -e

PROJECT_REF="gjqbbgrfhijescaouqkx"
ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA"

echo "🚀 Running migrations via Supabase API..."

# Read migration 1
MIGRATION_1=$(cat supabase/migrations/20251010000000_create_email_accounts_cache.sql)

# Execute via API
curl -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":$(echo "$MIGRATION_1" | jq -Rs .)}" \
  2>&1

echo ""
echo "✅ Attempting Migration 1..."
