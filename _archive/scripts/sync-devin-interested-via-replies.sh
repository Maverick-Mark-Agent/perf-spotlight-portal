#!/bin/bash

# Comprehensive Interested Leads Sync for Devin Hodo - REPLIES-BASED APPROACH
# Uses /api/replies?status=interested instead of tag filtering

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

# Devin Hodo workspace details
WORKSPACE_ID=37
WORKSPACE_NAME="Devin Hodo"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  Devin Hodo - Interested Leads Sync v2"
echo "  (Replies-based approach)"
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

# Step 2: Get interested replies metadata
echo -e "${YELLOW}Fetching interested replies metadata...${NC}"
FIRST_PAGE=$(curl -s -G "${BASE_URL}/replies" \
  --data-urlencode "status=interested" \
  --data-urlencode "per_page=100" \
  --data-urlencode "page=1" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Accept: application/json")

TOTAL_REPLIES=$(echo "$FIRST_PAGE" | jq '.meta.total')
LAST_PAGE=$(echo "$FIRST_PAGE" | jq '.meta.last_page')

echo -e "${BLUE}Total interested replies: ${TOTAL_REPLIES}${NC}"
echo -e "${BLUE}Total pages: ${LAST_PAGE}${NC}"
echo ""

# Step 3: Collect all unique lead IDs from replies
echo -e "${YELLOW}Collecting unique lead IDs from interested replies...${NC}"
LEAD_IDS=()

for page in $(seq 1 $LAST_PAGE); do
  echo "  Fetching replies page ${page}/${LAST_PAGE}..."

  REPLIES_PAGE=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=100" \
    --data-urlencode "page=${page}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Accept: application/json")

  # Extract lead_ids and add to array
  PAGE_LEAD_IDS=$(echo "$REPLIES_PAGE" | jq -r '.data[].lead_id | select(. != null)')
  LEAD_IDS+=($PAGE_LEAD_IDS)

  sleep 0.3  # Rate limiting
done

# Get unique lead IDs
UNIQUE_LEAD_IDS=($(printf "%s\n" "${LEAD_IDS[@]}" | sort -u))
UNIQUE_COUNT=${#UNIQUE_LEAD_IDS[@]}

echo -e "${CYAN}Found ${UNIQUE_COUNT} unique leads with interested replies${NC}"
echo ""

# Step 4: Fetch full lead details and sync to database
echo -e "${YELLOW}Syncing leads to database...${NC}"
SYNCED=0
SKIPPED=0
ERRORS=0

for lead_id in "${UNIQUE_LEAD_IDS[@]}"; do
  # Fetch full lead details
  LEAD_RESPONSE=$(curl -s "${BASE_URL}/leads/${lead_id}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Accept: application/json")

  # Check if lead data exists
  if ! echo "$LEAD_RESPONSE" | jq -e '.data.id' > /dev/null 2>&1; then
    echo "  ⚠️  Skipping lead ${lead_id} - no data found"
    ((SKIPPED++))
    continue
  fi

  LEAD=$(echo "$LEAD_RESPONSE" | jq '.data')

  LEAD_ID=$(echo "$LEAD" | jq -r '.id')
  FIRST_NAME=$(echo "$LEAD" | jq -r '.first_name // ""')
  LAST_NAME=$(echo "$LEAD" | jq -r '.last_name // ""')
  EMAIL=$(echo "$LEAD" | jq -r '.email')
  COMPANY=$(echo "$LEAD" | jq -r '.company // ""')
  TITLE=$(echo "$LEAD" | jq -r '.title // ""')

  # Get custom variables as JSON (escape quotes for bash)
  CUSTOM_VARS=$(echo "$LEAD" | jq -c '.custom_variables // []' | sed 's/"/\\"/g')

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
      \"custom_variables\": \"${CUSTOM_VARS}\"
    }")

  if [ $? -eq 0 ]; then
    ((SYNCED++))
    echo "  ✅ Synced: ${FIRST_NAME} ${LAST_NAME} (${EMAIL})"
  else
    ((ERRORS++))
    echo "  ❌ Error syncing: ${EMAIL}"
  fi

  sleep 0.2  # Rate limiting
done

# Summary
echo ""
echo "============================================"
echo -e "${GREEN}Sync Complete!${NC}"
echo "  Total interested replies: ${TOTAL_REPLIES}"
echo "  Unique leads found: ${UNIQUE_COUNT}"
echo "  Successfully synced: ${SYNCED}"
echo "  Skipped (no data): ${SKIPPED}"
echo "  Errors: ${ERRORS}"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. View pipeline: http://localhost:8082/client-portal/Devin%20Hodo"
echo "2. Verify in database: Check client_leads table for workspace_name = 'Devin Hodo'"
