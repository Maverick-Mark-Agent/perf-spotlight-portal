#!/bin/bash

# v3 - Update reply IDs by matching bison_lead_id (not email)

set -e

SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

WORKSPACE_ID=37
WORKSPACE_NAME="Devin Hodo"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  Reply ID Sync v3 - Devin Hodo"
echo "============================================"
echo ""

# Switch workspace
echo -e "${YELLOW}Switching workspace...${NC}"
curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"team_id\": ${WORKSPACE_ID}}" > /dev/null
echo -e "${GREEN}✅ Switched${NC}"
echo ""

# Collect reply mappings
echo -e "${YELLOW}Fetching reply → lead mappings...${NC}"
TEMP_FILE="/tmp/reply-mappings-$$.txt"
> "$TEMP_FILE"

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

  # Format: reply_id|lead_id
  echo "$REPLIES" | jq -r '.data[] | "\(.id)|\(.lead_id)"' >> "$TEMP_FILE"
  sleep 0.2
done

# Get unique leads (first reply per lead_id)
cat "$TEMP_FILE" | awk -F'|' '!seen[$2]++ {print}' > "${TEMP_FILE}.unique"
TOTAL=$(wc -l < "${TEMP_FILE}.unique" | tr -d ' ')
echo -e "${CYAN}Found ${TOTAL} unique leads${NC}"
echo ""

# Update database
echo -e "${YELLOW}Updating database...${NC}"
UPDATED=0

while IFS='|' read -r REPLY_ID LEAD_ID; do
  CONV_URL="https://send.maverickmarketingllc.com/workspaces/${WORKSPACE_ID}/replies/${REPLY_ID}"

  PAYLOAD=$(jq -n \
    --arg reply_id "$REPLY_ID" \
    --arg conv_url "$CONV_URL" \
    '{bison_reply_id: $reply_id, bison_conversation_url: $conv_url}')

  # Update by bison_lead_id
  curl -s -X PATCH "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.${WORKSPACE_NAME}&bison_lead_id=eq.${LEAD_ID}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$PAYLOAD" > /dev/null

  ((UPDATED++))
  echo "  ✅ Lead ${LEAD_ID} → Reply ${REPLY_ID}"

  sleep 0.05
done < "${TEMP_FILE}.unique"

rm -f "$TEMP_FILE" "${TEMP_FILE}.unique"

echo ""
echo "============================================"
echo -e "${GREEN}Complete! Updated ${UPDATED} leads${NC}"
echo "============================================"
