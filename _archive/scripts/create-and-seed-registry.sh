#!/bin/bash
# Create and seed client_registry table

echo "🔧 Creating client_registry table in Supabase..."

# Read the SQL file
SQL_FILE="./scripts/create-client-registry-table.sql"

# Execute via psql
PGPASSWORD="Maverick2024!" psql \
  "postgresql://postgres.gjqbbgrfhijescaouqkx:Maverick2024!@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
  -f "$SQL_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Table created successfully!"
  echo ""
  echo "🌱 Now deploying seed function..."

  cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"
  SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
    supabase functions deploy seed-client-registry --no-verify-jwt

  echo ""
  echo "🚀 Running seed function..."
  curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/seed-client-registry" | jq '.'

else
  echo "❌ Failed to create table"
  exit 1
fi
