#!/bin/bash

# Run migration to fix airtable_id constraint via Supabase API
# This uses the service role key to execute SQL directly

set -e

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
# Service role key will be passed as environment variable
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set"
  echo ""
  echo "Please provide your Supabase service role key:"
  echo "You can find it at: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/api"
  echo ""
  echo "Run this script like:"
  echo "  SUPABASE_SERVICE_ROLE_KEY='your-key-here' ./scripts/run-migration-fix-airtable.sh"
  exit 1
fi

echo "============================================"
echo "  Running Migration: Fix airtable_id"
echo "============================================"
echo ""

# SQL migration
SQL=$(cat << 'EOF'
-- Make airtable_id nullable
ALTER TABLE public.client_leads
ALTER COLUMN airtable_id DROP NOT NULL;

-- Drop the unique constraint on airtable_id
ALTER TABLE public.client_leads
DROP CONSTRAINT IF EXISTS client_leads_airtable_id_key;

-- Create proper unique constraint for Email Bison leads
ALTER TABLE public.client_leads
DROP CONSTRAINT IF EXISTS unique_lead_per_workspace;

ALTER TABLE public.client_leads
ADD CONSTRAINT unique_lead_per_workspace
UNIQUE (lead_email, workspace_name);

-- Keep airtable_id unique when it exists
DROP INDEX IF EXISTS idx_client_leads_airtable_unique;

CREATE UNIQUE INDEX idx_client_leads_airtable_unique
  ON public.client_leads(airtable_id)
  WHERE airtable_id IS NOT NULL;

-- Update comment
COMMENT ON COLUMN public.client_leads.airtable_id IS 'Airtable record ID (optional - only for Airtable-sourced leads). Email Bison leads use bison_lead_id instead.';

SELECT '✅ Migration completed successfully!' as status;
EOF
)

echo "Executing SQL migration..."
echo ""

# Execute SQL via Supabase REST API
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | jq -Rs .)}")

# Check for errors
ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')

if [ -n "$ERROR" ]; then
  echo "❌ Migration failed with error:"
  echo "$RESPONSE" | jq '.'
  echo ""
  echo "Trying alternative method via psql..."

  # Try direct postgres connection
  echo "$SQL" | PGPASSWORD="Maverick2024!" psql \
    -h aws-0-us-west-1.pooler.supabase.com \
    -p 5432 \
    -U postgres.gjqbbgrfhijescaouqkx \
    -d postgres

  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed via direct psql connection!"
  else
    echo ""
    echo "❌ Both methods failed. Please run the migration manually:"
    echo "File: supabase/migrations/MANUAL_RUN_fix_airtable_constraint.sql"
    echo "URL: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new"
    exit 1
  fi
else
  echo "$RESPONSE" | jq '.'
  echo ""
  echo "✅ Migration completed successfully!"
fi

echo ""
echo "============================================"
echo "Next step: Run the fixed sync script"
echo "  ./scripts/sync-devin-interested-FIXED.sh"
echo "============================================"
