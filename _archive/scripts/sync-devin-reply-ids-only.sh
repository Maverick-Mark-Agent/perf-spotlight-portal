#!/bin/bash

# Quick sync - just update reply IDs and conversation URLs for existing leads
# Assumes leads already exist in database from previous sync

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

WORKSPACE_ID=37
WORKSPACE_NAME="Devin Hodo"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  Quick Reply ID Sync - Devin Hodo"
echo "============================================"
echo ""

# Step 1: Switch workspace
echo -e "${YELLOW}Switching to Devin Hodo workspace...${NC}"
curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"team_id\": ${WORKSPACE_ID}}" > /dev/null

echo -e "${GREEN}✅ Switched${NC}"
echo ""

# Step 2: Collect all reply-to-lead mappings
echo -e "${YELLOW}Fetching interested replies...${NC}"
TEMP_REPLIES="/tmp/devin-quick-sync-$$.txt"
> "$TEMP_REPLIES"

FIRST_PAGE=$(curl -s -G "${BASE_URL}/replies" \
  --data-urlencode "status=interested" \
  --data-urlencode "per_page=100" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

LAST_PAGE=$(echo "$FIRST_PAGE" | jq '.meta.last_page')

for page in $(seq 1 $LAST_PAGE); do
  echo "  Page ${page}/${LAST_PAGE}..."

  REPLIES=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=100" \
    --data-urlencode "page=${page}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  # Extract: reply_id|lead_id|email
  echo "$REPLIES" | jq -r '.data[] | "\(.id)|\(.lead_id)|\(.lead_email)"' >> "$TEMP_REPLIES"

  sleep 0.2
done

# Get unique leads (first reply for each email)
cat "$TEMP_REPLIES" | awk -F'|' '!seen[$3]++ {print}' > "${TEMP_REPLIES}.unique"
UNIQUE_COUNT=$(wc -l < "${TEMP_REPLIES}.unique" | tr -d ' ')

echo -e "${CYAN}Found ${UNIQUE_COUNT} unique leads${NC}"
echo ""

# Step 3: Update database
echo -e "${YELLOW}Updating database...${NC}"
UPDATED=0
ERRORS=0

while IFS='|' read -r REPLY_ID LEAD_ID EMAIL; do
  # Build conversation URL
  CONVERSATION_URL="https://send.maverickmarketingllc.com/workspaces/${WORKSPACE_ID}/replies/${REPLY_ID}"

  # Update payload
  PAYLOAD=$(jq -n \
    --arg reply_id "$REPLY_ID" \
    --arg conv_url "$CONVERSATION_URL" \
    '{
      bison_reply_id: $reply_id,
      bison_conversation_url: $conv_url
    }')

  # Update existing lead
  RESPONSE=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.${WORKSPACE_NAME}&lead_email=eq.${EMAIL}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$PAYLOAD")

  # Check for errors
  ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message // empty' 2>/dev/null)

  if [ -n "$ERROR_MSG" ]; then
    ((ERRORS++))
    echo "  ❌ ${EMAIL}: $ERROR_MSG"
  else
    ((UPDATED++))
    echo "  ✅ ${EMAIL} → Reply ${REPLY_ID}"
  fi

  sleep 0.1
done < "${TEMP_REPLIES}.unique"

# Cleanup
rm -f "$TEMP_REPLIES" "${TEMP_REPLIES}.unique"

echo ""
echo "============================================"
echo -e "${GREEN}Sync Complete!${NC}"
echo "  Updated: ${UPDATED}"
echo "  Errors: ${ERRORS}"
echo "============================================"
