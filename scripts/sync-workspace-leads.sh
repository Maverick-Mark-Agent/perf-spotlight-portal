#!/bin/bash

# Template script for syncing Email Bison workspace leads
# Usage: ./sync-workspace-leads.sh <workspace_id> "<workspace_name>"

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <workspace_id> \"<workspace_name>\""
  echo "Example: $0 9 \"StreetSmart Trucking\""
  exit 1
fi

SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q"

WORKSPACE_ID=$1
WORKSPACE_NAME=$2

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo "============================================"
echo "  Sync Email Bison Leads: ${WORKSPACE_NAME}"
echo "============================================"
echo ""

# Switch workspace
echo -e "${YELLOW}Switching to ${WORKSPACE_NAME} workspace...${NC}"
SWITCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"team_id\": ${WORKSPACE_ID}}")

if echo "$SWITCH_RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ Failed to switch workspace${NC}"
  echo "$SWITCH_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Switched${NC}"
echo ""

# Fetch ALL interested replies
echo -e "${YELLOW}Fetching all interested replies...${NC}"
TEMP_FILE="/tmp/workspace-${WORKSPACE_ID}-replies-$$.txt"
> "$TEMP_FILE"

FIRST_PAGE=$(curl -s -G "${BASE_URL}/replies" \
  --data-urlencode "status=interested" \
  --data-urlencode "per_page=100" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

LAST_PAGE=$(echo "$FIRST_PAGE" | jq '.meta.last_page')
TOTAL_REPLIES=$(echo "$FIRST_PAGE" | jq '.meta.total')

if [ "$LAST_PAGE" = "null" ] || [ "$TOTAL_REPLIES" = "null" ]; then
  echo -e "${RED}❌ Failed to fetch replies${NC}"
  echo "$FIRST_PAGE"
  exit 1
fi

echo -e "${CYAN}Total interested replies: ${TOTAL_REPLIES} (${LAST_PAGE} pages)${NC}"

for page in $(seq 1 $LAST_PAGE); do
  echo "  Fetching page ${page}/${LAST_PAGE}..."

  REPLIES=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=100" \
    --data-urlencode "page=${page}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  echo "$REPLIES" | jq -c '.data[]' >> "$TEMP_FILE"
done

# Create leads from replies
echo ""
echo -e "${YELLOW}Creating leads in database...${NC}"
CREATED=0
ERRORS=0

while IFS= read -r reply; do
  REPLY_ID=$(echo "$reply" | jq -r '.id')
  REPLY_UUID=$(echo "$reply" | jq -r '.uuid')
  LEAD_ID=$(echo "$reply" | jq -r '.lead_id')
  FROM_EMAIL=$(echo "$reply" | jq -r '.from_email_address')
  FROM_NAME=$(echo "$reply" | jq -r '.from_name')
  DATE_RECEIVED=$(echo "$reply" | jq -r '.date_received')
  SUBJECT=$(echo "$reply" | jq -r '.subject')
  BODY=$(echo "$reply" | jq -r '.text_body // .html_body')

  # Split name
  FIRST_NAME=$(echo "$FROM_NAME" | awk '{print $1}')
  LAST_NAME=$(echo "$FROM_NAME" | awk '{$1=""; print $0}' | xargs)

  # Generate conversation URL
  CONV_URL="https://send.maverickmarketingllc.com/inbox/replies/${REPLY_UUID}"

  # Create lead record
  PAYLOAD=$(jq -n \
    --arg ws "$WORKSPACE_NAME" \
    --arg lid "$LEAD_ID" \
    --arg rid "$REPLY_ID" \
    --arg uuid "$REPLY_UUID" \
    --arg email "$FROM_EMAIL" \
    --arg first "$FIRST_NAME" \
    --arg last "$LAST_NAME" \
    --arg date "$DATE_RECEIVED" \
    --arg subject "$SUBJECT" \
    --arg body "$BODY" \
    --arg url "$CONV_URL" \
    '{
      workspace_name: $ws,
      bison_lead_id: $lid,
      bison_reply_id: $rid,
      bison_reply_uuid: $uuid,
      lead_email: $email,
      first_name: $first,
      last_name: $last,
      date_received: $date,
      email_subject: $subject,
      reply_received: $body,
      bison_conversation_url: $url,
      interested: true,
      pipeline_stage: "interested",
      lead_value: 500
    }')

  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/client_leads" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$PAYLOAD")

  if echo "$RESPONSE" | jq -e 'has("code")' > /dev/null 2>&1; then
    ((ERRORS++))
  else
    ((CREATED++))
    if [ $((CREATED % 50)) -eq 0 ]; then
      echo "  ✅ Created ${CREATED} leads..."
    fi
  fi
done < "$TEMP_FILE"

rm -f "$TEMP_FILE"

echo ""
echo "============================================"
echo -e "${GREEN}Complete! Created ${CREATED} leads${NC}"
if [ $ERRORS -gt 0 ]; then
  echo -e "${YELLOW}Errors: ${ERRORS} (likely duplicates)${NC}"
fi
echo "============================================"
