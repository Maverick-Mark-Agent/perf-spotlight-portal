#!/bin/bash

# Quick single-client lead sync script
# Usage: ./sync-single-client.sh <workspace_name> <workspace_id>

if [ $# -ne 2 ]; then
  echo "Usage: $0 <workspace_name> <workspace_id>"
  echo "Example: $0 \"Kim Wallace\" 4"
  exit 1
fi

WORKSPACE_NAME="$1"
WORKSPACE_ID="$2"

SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  Syncing: ${WORKSPACE_NAME}"
echo "============================================"
echo ""

# Switch workspace
echo -e "${YELLOW}[1/4] Switching to workspace...${NC}"
curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"team_id\": ${WORKSPACE_ID}}" > /dev/null

sleep 2
echo -e "${GREEN}✓ Switched${NC}"
echo ""

# Count interested replies
echo -e "${YELLOW}[2/4] Counting interested replies...${NC}"
COUNT_RESPONSE=$(curl -s -G "${BASE_URL}/replies" \
  --data-urlencode "status=interested" \
  --data-urlencode "per_page=1" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

TOTAL_REPLIES=$(echo "$COUNT_RESPONSE" | jq -r '.meta.total // 0')
LAST_PAGE=$(echo "$COUNT_RESPONSE" | jq -r '.meta.last_page // 0')

echo -e "${CYAN}Total: ${TOTAL_REPLIES} interested replies (${LAST_PAGE} pages)${NC}"
echo ""

if [ "$TOTAL_REPLIES" == "0" ]; then
  echo "No leads to sync."
  exit 0
fi

# Fetch all leads and sync
echo -e "${YELLOW}[3/4] Fetching and syncing leads...${NC}"
SYNCED=0
ERRORS=0

for page in $(seq 1 $LAST_PAGE); do
  echo -ne "  Page ${page}/${LAST_PAGE}...\r"

  REPLIES=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=100" \
    --data-urlencode "page=${page}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  # Extract lead IDs
  LEAD_IDS=$(echo "$REPLIES" | jq -r '.data[].lead_id' 2>/dev/null | sort -u)

  for lead_id in $LEAD_IDS; do
    if [ -z "$lead_id" ] || [ "$lead_id" == "null" ]; then
      continue
    fi

    # Fetch lead details
    LEAD=$(curl -s -X GET "${BASE_URL}/leads/${lead_id}" \
      -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

    EMAIL=$(echo "$LEAD" | jq -r '.data.email // empty' 2>/dev/null)

    if [ -z "$EMAIL" ] || [ "$EMAIL" == "null" ]; then
      ((ERRORS++))
      continue
    fi

    FIRST_NAME=$(echo "$LEAD" | jq -r '.data.first_name // ""' 2>/dev/null)
    LAST_NAME=$(echo "$LEAD" | jq -r '.data.last_name // ""' 2>/dev/null)
    COMPANY=$(echo "$LEAD" | jq -r '.data.company // ""' 2>/dev/null)
    TITLE=$(echo "$LEAD" | jq -r '.data.title // ""' 2>/dev/null)
    PHONE=$(echo "$LEAD" | jq -r '.data.custom_variables[]? | select(.name == "Phone" or .name == "phone") | .value // ""' 2>/dev/null | head -1)

    # Create payload
    PAYLOAD=$(jq -n \
      --arg ws "$WORKSPACE_NAME" \
      --arg email "$EMAIL" \
      --arg fname "$FIRST_NAME" \
      --arg lname "$LAST_NAME" \
      --arg company "$COMPANY" \
      --arg title "$TITLE" \
      --arg phone "$PHONE" \
      --arg bison_id "$lead_id" \
      '{
        workspace_name: $ws,
        lead_email: $email,
        first_name: $fname,
        last_name: $lname,
        company_name: $company,
        title: $title,
        phone: $phone,
        bison_lead_id: $bison_id,
        interested: true,
        pipeline_stage: "interested"
      }')

    # Upsert to database
    curl -s -X POST "${SUPABASE_URL}/rest/v1/client_leads" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: resolution=merge-duplicates" \
      -d "$PAYLOAD" > /dev/null 2>&1

    if [ $? -eq 0 ]; then
      ((SYNCED++))
    else
      ((ERRORS++))
    fi

    sleep 0.1  # Rate limiting
  done

  sleep 0.5  # Page rate limiting
done

echo -e "\n${GREEN}✓ Synced ${SYNCED} leads${NC} (${ERRORS} errors)"
echo ""

# Verify
echo -e "${YELLOW}[4/4] Verifying...${NC}"
DB_COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.${WORKSPACE_NAME// /%20}&interested=eq.true&select=count" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq -r '.[0].count // 0')

echo -e "${CYAN}Database now has: ${DB_COUNT} interested leads${NC}"
echo -e "${CYAN}Email Bison has: ${TOTAL_REPLIES} interested replies${NC}"

GAP=$((TOTAL_REPLIES - DB_COUNT))
if [ $GAP -eq 0 ]; then
  echo -e "${GREEN}✓ Perfect sync!${NC}"
elif [ $GAP -le 2 ]; then
  echo -e "${GREEN}✓ Acceptable gap: ${GAP}${NC}"
else
  echo -e "${YELLOW}⚠ Gap remaining: ${GAP}${NC}"
fi

echo ""
echo "Done!"
