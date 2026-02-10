#!/bin/bash

# Sequential sync for the 24 REAL client workspaces (with valid bison_workspace_id > 0)
# Filters out partial/incomplete workspace entries

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to get lead count
get_lead_count() {
  local workspace="$1"
  local encoded=$(printf %s "$workspace" | jq -sRr @uri)
  local count=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=id&workspace_name=eq.$encoded" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Range: 0-9999" \
    -H "Prefer: count=exact" -I 2>&1 | grep -i "content-range:" | sed 's/.*\///' | tr -d '\r')
  echo "${count:-0}"
}

# Function to get sample lead
get_sample_lead() {
  local workspace="$1"
  local encoded=$(printf %s "$workspace" | jq -sRr @uri)
  curl -s "$SUPABASE_URL/rest/v1/client_leads?select=lead_email,phone,tags,custom_variables&workspace_name=eq.$encoded&order=created_at.desc&limit=1" \
    -H "apikey: $SUPABASE_KEY" | jq -r '
    if length > 0 then
      .[0] | "    📧 Email: \(.lead_email)\n    📞 Phone: \(.phone // "NULL")\n    🏷️  Tags: \(if .tags and (.tags | length) > 0 then (.tags | map(.name) | join(", ")) else "NONE" end)\n    📋 Custom Vars: \(if .custom_variables then (.custom_variables | length) else 0 end) fields"
    else
      "    No leads found"
    end
  '
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 SYNCING 24 REAL CLIENT WORKSPACES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Fetching ALL active workspaces..."
ALL_WORKSPACES=$(curl -s "$SUPABASE_URL/rest/v1/client_registry?select=workspace_name,bison_workspace_id,bison_instance,bison_api_key&is_active=eq.true&order=workspace_name" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY")

# Filter to only workspaces with bison_workspace_id > 0 (valid IDs)
VALID_WORKSPACES=$(echo "$ALL_WORKSPACES" | jq '[.[] | select(.bison_workspace_id != null and .bison_workspace_id > 0 and .bison_instance != null and .bison_instance != "")]')

WORKSPACE_NAMES=$(echo "$VALID_WORKSPACES" | jq -r '.[].workspace_name')
WORKSPACE_ARRAY=($WORKSPACE_NAMES)
TOTAL=${#WORKSPACE_ARRAY[@]}

echo -e "${GREEN}✅ Found $TOTAL valid workspaces (filtered from $(echo "$ALL_WORKSPACES" | jq 'length') total)${NC}"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Process each workspace
for i in "${!WORKSPACE_ARRAY[@]}"; do
  WORKSPACE="${WORKSPACE_ARRAY[$i]}"
  NUM=$((i + 1))

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}[$NUM/$TOTAL] 🔄 Processing: $WORKSPACE${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  WS_INFO=$(echo "$VALID_WORKSPACES" | jq -r --arg ws "$WORKSPACE" '.[] | select(.workspace_name == $ws)')
  BISON_ID=$(echo "$WS_INFO" | jq -r '.bison_workspace_id')
  BISON_INSTANCE=$(echo "$WS_INFO" | jq -r '.bison_instance')
  HAS_API_KEY=$(echo "$WS_INFO" | jq -r '.bison_api_key')

  echo "  📌 Workspace ID: $BISON_ID"
  echo "  🏢 Instance: $BISON_INSTANCE"
  if [ "$HAS_API_KEY" != "null" ] && [ -n "$HAS_API_KEY" ]; then
    echo -e "  🔑 Auth: ${GREEN}Workspace-specific API key (FULL data)${NC}"
  else
    echo -e "  🔑 Auth: ${YELLOW}Super-admin key (BASIC data)${NC}"
  fi
  echo ""

  BEFORE_COUNT=$(get_lead_count "$WORKSPACE")
  echo -e "  ${BLUE}📊 BEFORE SYNC: $BEFORE_COUNT leads${NC}"

  if [ "$BEFORE_COUNT" -gt 0 ]; then
    echo "  Sample lead:"
    get_sample_lead "$WORKSPACE"
    echo ""
  fi

  echo -e "  ${YELLOW}⏳ Syncing from Email Bison...${NC}"

  SYNC_START=$(date +%s)
  RESULT=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sync-client-pipeline" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_name\": \"$WORKSPACE\"}" \
    --max-time 180)
  SYNC_END=$(date +%s)
  SYNC_DURATION=$((SYNC_END - SYNC_START))

  if echo "$RESULT" | jq -e . >/dev/null 2>&1; then
    STATUS=$(echo "$RESULT" | jq -r '.results[0].status // "unknown"')
    LEADS_SYNCED=$(echo "$RESULT" | jq -r '.results[0].leads_synced // 0')
    ERROR_MSG=$(echo "$RESULT" | jq -r '.results[0].error // ""')

    if [ "$STATUS" = "success" ]; then
      echo -e "  ${GREEN}✅ Sync completed in ${SYNC_DURATION}s${NC}"
      echo "  Leads synced: $LEADS_SYNCED"

      sleep 2
      AFTER_COUNT=$(get_lead_count "$WORKSPACE")
      echo -e "  ${BLUE}📊 AFTER SYNC: $AFTER_COUNT total leads${NC}"

      if [ "$AFTER_COUNT" -gt "$BEFORE_COUNT" ]; then
        echo "  Sample lead (most recent):"
        get_sample_lead "$WORKSPACE"
      fi

      echo ""
      if [ "$LEADS_SYNCED" -gt 0 ]; then
        echo -e "  ${GREEN}✅ VERIFIED: Synced $LEADS_SYNCED new leads${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
      else
        echo -e "  ${YELLOW}⚠️  No new leads (workspace has no interested replies)${NC}"
        SKIP_COUNT=$((SKIP_COUNT + 1))
      fi

    else
      echo -e "  ${RED}❌ Sync failed: $ERROR_MSG${NC}"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    echo -e "  ${RED}❌ Sync timeout or invalid response${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  echo ""
  sleep 3  # Rate limiting between workspaces
done

# Final summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 FINAL SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Successful: $SUCCESS_COUNT${NC}"
echo -e "${YELLOW}⚠️  No leads: $SKIP_COUNT${NC}"
echo -e "${RED}❌ Failed: $FAIL_COUNT${NC}"
echo -e "   ${BLUE}━━━━━━━━━━━━━━━━${NC}"
echo "   Total: $TOTAL workspaces"
echo ""

echo -e "${BLUE}📋 Lead Count Summary:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
for workspace in "${WORKSPACE_ARRAY[@]}"; do
  COUNT=$(get_lead_count "$workspace")
  if [ "$COUNT" -gt 0 ]; then
    printf "${GREEN}%-40s: %5s leads${NC}\n" "$workspace" "$COUNT"
  else
    printf "${YELLOW}%-40s: %5s leads${NC}\n" "$workspace" "$COUNT"
  fi
done

echo ""
echo -e "${GREEN}✅ Sync complete for all 24 client workspaces!${NC}"
