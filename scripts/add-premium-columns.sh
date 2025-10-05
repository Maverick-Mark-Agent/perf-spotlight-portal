#!/bin/bash

# Add premium_amount and policy_type columns to client_leads table

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

echo "Adding premium_amount and policy_type columns..."

# Check current columns
echo "Current table structure:"
curl -s "${SUPABASE_URL}/rest/v1/client_leads?limit=1" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin)[0] if json.load(sys.stdin) else {}, indent=2))" 2>/dev/null || echo "Table queried"

echo ""
echo "Note: Columns need to be added via Supabase Dashboard or direct PostgreSQL connection"
echo "Migration file created at: supabase/migrations/20251004120000_add_premium_policy_fields.sql"
echo ""
echo "For now, proceeding with frontend development..."
echo "The database columns will be added when you run: supabase db push"
