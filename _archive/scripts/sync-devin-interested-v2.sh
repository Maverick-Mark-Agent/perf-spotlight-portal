#!/bin/bash

# FIXED v2 - Comprehensive Interested Leads Sync with Reply IDs for Conversation Links
# Uses /api/replies?status=interested and captures reply_id for working conversation URLs

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
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  Devin Hodo - v2 Interested Leads Sync"
echo "  (With Reply IDs for Conversation Links)"
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

# Step 3: Collect all reply data to temp file
echo -e "${YELLOW}Collecting reply and lead ID pairs...${NC}"
TEMP_REPLIES="/tmp/devin-replies-$$.txt"
> "$TEMP_REPLIES"  # Clear file

for page in $(seq 1 $LAST_PAGE); do
  echo "  Fetching replies page ${page}/${LAST_PAGE}..."

  REPLIES_PAGE=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=100" \
    --data-urlencode "page=${page}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Accept: application/json")

  # Extract reply_id and lead_id pairs, append to file
  echo "$REPLIES_PAGE" | jq -r '.data[] | "\(.id)|\(.lead_id)"' >> "$TEMP_REPLIES"

  sleep 0.3  # Rate limiting
done

# Get unique lead IDs (keep first reply_id for each lead)
cat "$TEMP_REPLIES" | awk -F'|' '!seen[$2]++ {print}' > "${TEMP_REPLIES}.unique"
UNIQUE_COUNT=$(wc -l < "${TEMP_REPLIES}.unique" | tr -d ' ')

echo -e "${CYAN}Found ${UNIQUE_COUNT} unique leads with interested replies${NC}"
echo ""

# Step 4: Fetch full lead details and sync to database
echo -e "${YELLOW}Syncing leads to database with reply IDs...${NC}"
SYNCED=0
SKIPPED=0
ERRORS=0

while IFS='|' read -r REPLY_ID LEAD_ID; do
  # Fetch full lead details
  LEAD_RESPONSE=$(curl -s "${BASE_URL}/leads/${LEAD_ID}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Accept: application/json")

  # Check if lead data exists
  if ! echo "$LEAD_RESPONSE" | jq -e '.data.id' > /dev/null 2>&1; then
    echo "  ⚠️  Skipping lead ${LEAD_ID} - no data found"
    ((SKIPPED++))
    continue
  fi

  LEAD=$(echo "$LEAD_RESPONSE" | jq '.data')

  # Extract fields
  FIRST_NAME=$(echo "$LEAD" | jq -r '.first_name // ""')
  LAST_NAME=$(echo "$LEAD" | jq -r '.last_name // ""')
  EMAIL=$(echo "$LEAD" | jq -r '.email')
  COMPANY=$(echo "$LEAD" | jq -r '.company // ""')
  TITLE=$(echo "$LEAD" | jq -r '.title // ""')

  # Build conversation URL using reply ID
  CONVERSATION_URL="https://send.maverickmarketingllc.com/workspaces/${WORKSPACE_ID}/replies/${REPLY_ID}"

  # Build complete JSON payload using jq (ensures proper JSON structure)
  PAYLOAD=$(jq -n \
    --arg bison_lead_id "$LEAD_ID" \
    --arg bison_reply_id "$REPLY_ID" \
    --arg workspace_name "$WORKSPACE_NAME" \
    --arg workspace_id "$WORKSPACE_ID" \
    --arg first_name "$FIRST_NAME" \
    --arg last_name "$LAST_NAME" \
    --arg lead_email "$EMAIL" \
    --arg company "$COMPANY" \
    --arg title "$TITLE" \
    --arg conversation_url "$CONVERSATION_URL" \
    --argjson custom_variables "$(echo "$LEAD" | jq '.custom_variables // []')" \
    '{
      bison_lead_id: $bison_lead_id,
      bison_reply_id: $bison_reply_id,
      bison_workspace_id: ($workspace_id | tonumber),
      bison_conversation_url: $conversation_url,
      workspace_name: $workspace_name,
      first_name: $first_name,
      last_name: $last_name,
      lead_email: $lead_email,
      company: $company,
      title: $title,
      interested: true,
      pipeline_stage: "interested",
      custom_variables: $custom_variables,
      airtable_id: null
    }')

  # Update existing lead with reply ID and conversation URL
  UPDATE_PAYLOAD=$(jq -n \
    --arg bison_reply_id "$REPLY_ID" \
    --arg conversation_url "$CONVERSATION_URL" \
    '{
      bison_reply_id: $bison_reply_id,
      bison_conversation_url: $conversation_url
    }')

  UPSERT_RESPONSE=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.${WORKSPACE_NAME}&lead_email=eq.${EMAIL}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$UPDATE_PAYLOAD")

  # Check for errors in response
  ERROR_MSG=$(echo "$UPSERT_RESPONSE" | jq -r '.message // empty')

  if [ -n "$ERROR_MSG" ]; then
    ((ERRORS++))
    echo "  ❌ Error syncing ${EMAIL}: $ERROR_MSG"
  else
    ((SYNCED++))
    echo "  ✅ Synced: ${FIRST_NAME} ${LAST_NAME} (${EMAIL}) [Reply: ${REPLY_ID}]"
  fi

  sleep 0.1  # Rate limiting
done < "${TEMP_REPLIES}.unique"

# Cleanup temp files
rm -f "$TEMP_REPLIES" "${TEMP_REPLIES}.unique"

echo ""
echo "============================================"
echo -e "${GREEN}Sync Complete!${NC}"
echo "  Total interested replies: ${TOTAL_REPLIES}"
echo "  Unique leads found: ${UNIQUE_COUNT}"
echo "  Successfully synced: ${SYNCED}"
echo "  Skipped (no data): ${SKIPPED}"
echo "  Errors: ${ERRORS}"
echo "============================================"

if [ $SYNCED -gt 0 ]; then
  echo ""
  echo -e "${GREEN}🎉 All leads synced with conversation URLs!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. View pipeline: http://localhost:8082/client-portal/Devin%20Hodo"
  echo "2. Click on any lead to see 'View in Email Bison' link"
  echo "3. Test the conversation link in your browser"
fi
