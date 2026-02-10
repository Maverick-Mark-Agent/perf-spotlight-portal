#!/bin/bash

# Comprehensive Interested Leads Sync for Devin Hodo
# Pulls ALL interested leads from Email Bison and syncs to Supabase CRM pipeline

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

# Devin Hodo workspace details
WORKSPACE_ID=37
WORKSPACE_NAME="Devin Hodo"
INTERESTED_TAG_ID=578

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "============================================"
echo "  Devin Hodo - Interested Leads Sync"
echo "============================================"
echo ""

# Step 1: Switch to Devin Hodo's workspace
echo -e "${YELLOW}Switching to Devin Hodo workspace...${NC}"
SWITCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"team_id\": ${WORKSPACE_ID}}")

if ! echo "$SWITCH_RESPONSE" | grep -q '"name"'; then
  echo -e "${RED}❌ Failed to switch workspace${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Switched to workspace: $(echo "$SWITCH_RESPONSE" | jq -r '.data.name')${NC}"
echo ""

# Step 2: Get first page to determine total
echo -e "${YELLOW}Fetching interested leads metadata...${NC}"
FIRST_PAGE=$(curl -s -G "${BASE_URL}/leads" \
  --data-urlencode "filters[tag_ids][]=${INTERESTED_TAG_ID}" \
  --data-urlencode "per_page=100" \
  --data-urlencode "page=1" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Accept: application/json")

TOTAL=$(echo "$FIRST_PAGE" | jq '.meta.total')
LAST_PAGE=$(echo "$FIRST_PAGE" | jq '.meta.last_page')

echo -e "${BLUE}Total interested leads: ${TOTAL}${NC}"
echo -e "${BLUE}Total pages: ${LAST_PAGE}${NC}"
echo ""

# Step 3: Fetch all pages and sync to database
SYNCED=0
SKIPPED=0
ERRORS=0

for page in $(seq 1 $LAST_PAGE); do
  echo -e "${YELLOW}Processing page ${page}/${LAST_PAGE}...${NC}"

  # Fetch leads for this page
  LEADS_PAGE=$(curl -s -G "${BASE_URL}/leads" \
    --data-urlencode "filters[tag_ids][]=${INTERESTED_TAG_ID}" \
    --data-urlencode "per_page=100" \
    --data-urlencode "page=${page}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Accept: application/json")

  # Extract leads data
  LEADS_COUNT=$(echo "$LEADS_PAGE" | jq '.data | length')
  echo "  Found ${LEADS_COUNT} leads on this page"

  # Process each lead
  for i in $(seq 0 $((LEADS_COUNT - 1))); do
    LEAD=$(echo "$LEADS_PAGE" | jq -r ".data[$i]")

    LEAD_ID=$(echo "$LEAD" | jq -r '.id')
    FIRST_NAME=$(echo "$LEAD" | jq -r '.first_name // ""')
    LAST_NAME=$(echo "$LEAD" | jq -r '.last_name // ""')
    EMAIL=$(echo "$LEAD" | jq -r '.email')
    COMPANY=$(echo "$LEAD" | jq -r '.company // ""')
    TITLE=$(echo "$LEAD" | jq -r '.title // ""')

    # Get custom variables as JSON
    CUSTOM_VARS=$(echo "$LEAD" | jq -c '.custom_variables // []')

    # Insert/update lead in Supabase
    UPSERT_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/client_leads" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: resolution=merge-duplicates" \
      -d "{
        \"bison_lead_id\": ${LEAD_ID},
        \"workspace_name\": \"${WORKSPACE_NAME}\",
        \"first_name\": \"${FIRST_NAME}\",
        \"last_name\": \"${LAST_NAME}\",
        \"email\": \"${EMAIL}\",
        \"company\": \"${COMPANY}\",
        \"title\": \"${TITLE}\",
        \"interested\": true,
        \"pipeline_stage\": \"interested\",
        \"custom_variables\": ${CUSTOM_VARS}
      }")

    if [ $? -eq 0 ]; then
      ((SYNCED++))
      echo "    ✅ Synced: ${FIRST_NAME} ${LAST_NAME} (${EMAIL})"
    else
      ((ERRORS++))
      echo "    ❌ Error syncing: ${EMAIL}"
    fi
  done

  echo ""
  sleep 0.5  # Rate limiting
done

# Summary
echo "============================================"
echo -e "${GREEN}Sync Complete!${NC}"
echo "  Total leads from API: ${TOTAL}"
echo "  Successfully synced: ${SYNCED}"
echo "  Errors: ${ERRORS}"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. View pipeline: http://localhost:8082/client-portal/Devin%20Hodo"
echo "2. Verify in database: Check client_leads table for workspace_name = 'Devin Hodo'"
