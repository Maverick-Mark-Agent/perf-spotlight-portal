#!/bin/bash
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

WORKSPACE_ID=4
WORKSPACE_NAME="Kim Wallace"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  Sync Kim Wallace Leads with Reply UUIDs"
echo "============================================"
echo ""

# Switch workspace
echo -e "${YELLOW}Switching to Kim Wallace workspace...${NC}"
curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"team_id\": ${WORKSPACE_ID}}" > /dev/null
echo -e "${GREEN}✅ Switched${NC}"
echo ""

# Fetch all interested replies with UUIDs
echo -e "${YELLOW}Fetching interested reply UUIDs...${NC}"
TEMP_FILE="/tmp/kim-wallace-reply-uuids-$$.txt"
> "$TEMP_FILE"

FIRST_PAGE=$(curl -s -G "${BASE_URL}/replies" \
  --data-urlencode "status=interested" \
  --data-urlencode "per_page=100" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

LAST_PAGE=$(echo "$FIRST_PAGE" | jq '.meta.last_page')
TOTAL_REPLIES=$(echo "$FIRST_PAGE" | jq '.meta.total')

echo -e "${CYAN}Total interested replies: ${TOTAL_REPLIES} (${LAST_PAGE} pages)${NC}"

for page in $(seq 1 $LAST_PAGE); do
  echo "  Page ${page}/${LAST_PAGE}..."

  REPLIES=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=100" \
    --data-urlencode "page=${page}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  # Extract: reply_uuid|lead_id
  echo "$REPLIES" | jq -r '.data[] | "\(.uuid)|\(.lead_id)"' >> "$TEMP_FILE"
done

# Get unique leads (one UUID per lead_id)
cat "$TEMP_FILE" | awk -F'|' '!seen[$2]++ {print}' > "${TEMP_FILE}.unique"
TOTAL=$(wc -l < "${TEMP_FILE}.unique" | tr -d ' ')

echo -e "${CYAN}Found ${TOTAL} unique leads with interested replies${NC}"
echo ""

# Update database
echo -e "${YELLOW}Updating database with UUIDs...${NC}"
UPDATED=0

while IFS='|' read -r REPLY_UUID LEAD_ID; do
  # Generate conversation URL
  CONV_URL="https://send.maverickmarketingllc.com/inbox/replies/${REPLY_UUID}"

  PAYLOAD=$(jq -n \
    --arg uuid "$REPLY_UUID" \
    --arg url "$CONV_URL" \
    '{bison_reply_uuid: $uuid, bison_conversation_url: $url, interested: true}')

  # Update by bison_lead_id
  curl -s -X PATCH "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.Kim%20Wallace&bison_lead_id=eq.${LEAD_ID}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$PAYLOAD" > /dev/null

  ((UPDATED++))
  if [ $((UPDATED % 50)) -eq 0 ]; then
    echo "  ✅ Updated ${UPDATED}/${TOTAL} leads..."
  fi
done < "${TEMP_FILE}.unique"

rm -f "$TEMP_FILE" "${TEMP_FILE}.unique"

echo ""
echo "============================================"
echo -e "${GREEN}Complete! Updated ${UPDATED} Kim Wallace leads${NC}"
echo "============================================"
echo ""
echo "URL Pattern: /inbox/replies/{uuid}"
