#!/bin/bash

# Sequential verified sync - process one workspace at a time with verification
# Shows before/after lead counts and waits for user confirmation to proceed

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to get lead count for a workspace
get_lead_count() {
  local workspace="$1"
  local encoded=$(printf %s "$workspace" | jq -sRr @uri)
  local count=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=id&workspace_name=eq.$encoded" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Range: 0-9999" \
    -H "Prefer: count=exact" -I 2>&1 | grep -i "content-range:" | sed 's/.*\///' | tr -d '\r')
  echo "${count:-0}"
}

# Function to get sample lead data
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

# Get all active workspaces with API keys
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 SEQUENTIAL VERIFIED SYNC${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Fetching active workspaces with complete metadata..."
WORKSPACES=$(curl -s "$SUPABASE_URL/rest/v1/client_registry?select=workspace_name,bison_workspace_id,bison_instance,bison_api_key&is_active=eq.true&bison_workspace_id=not.is.null&bison_instance=not.is.null&order=workspace_name" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY")

WORKSPACE_NAMES=$(echo "$WORKSPACES" | jq -r '.[].workspace_name')
WORKSPACE_ARRAY=($WORKSPACE_NAMES)
TOTAL=${#WORKSPACE_ARRAY[@]}

echo -e "${GREEN}✅ Found $TOTAL workspaces with API keys${NC}"
echo ""

# Summary counters
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

  # Get workspace details
  WS_INFO=$(echo "$WORKSPACES" | jq -r --arg ws "$WORKSPACE" '.[] | select(.workspace_name == $ws)')
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

  # Get BEFORE count
  echo -e "  ${BLUE}📊 BEFORE SYNC:${NC}"
  BEFORE_COUNT=$(get_lead_count "$WORKSPACE")
  echo "  Current leads in database: $BEFORE_COUNT"

  if [ "$BEFORE_COUNT" -gt 0 ]; then
    echo ""
    echo "  Sample lead:"
    get_sample_lead "$WORKSPACE"
  fi

  echo ""
  echo -e "  ${YELLOW}⏳ Syncing from Email Bison...${NC}"

  # Perform sync
  SYNC_START=$(date +%s)
  RESULT=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sync-client-pipeline" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_name\": \"$WORKSPACE\"}" \
    --max-time 180)
  SYNC_END=$(date +%s)
  SYNC_DURATION=$((SYNC_END - SYNC_START))

  # Parse result
  if echo "$RESULT" | jq -e . >/dev/null 2>&1; then
    STATUS=$(echo "$RESULT" | jq -r '.results[0].status // "unknown"')
    LEADS_SYNCED=$(echo "$RESULT" | jq -r '.results[0].leads_synced // 0')
    ERROR_MSG=$(echo "$RESULT" | jq -r '.results[0].error // ""')

    if [ "$STATUS" = "success" ]; then
      echo -e "  ${GREEN}✅ Sync completed in ${SYNC_DURATION}s${NC}"
      echo "  Leads synced: $LEADS_SYNCED"

      # Get AFTER count
      echo ""
      echo -e "  ${BLUE}📊 AFTER SYNC:${NC}"
      sleep 2  # Give database a moment to settle
      AFTER_COUNT=$(get_lead_count "$WORKSPACE")
      echo "  Total leads in database: $AFTER_COUNT"

      if [ "$AFTER_COUNT" -gt 0 ]; then
        echo ""
        echo "  Sample lead (most recent):"
        get_sample_lead "$WORKSPACE"
      fi

      # Verification
      echo ""
      if [ "$LEADS_SYNCED" -gt 0 ]; then
        echo -e "  ${GREEN}✅ VERIFIED: $AFTER_COUNT total leads ($LEADS_SYNCED synced this run)${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
      else
        echo -e "  ${YELLOW}⚠️  No new leads to sync (workspace has no interested replies)${NC}"
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

  # Don't wait after last workspace
  if [ $NUM -lt $TOTAL ]; then
    echo -e "${YELLOW}⏭️  Press Enter to continue to next workspace...${NC}"
    read -r
  fi

  echo ""
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

# Show workspace lead summary
echo -e "${BLUE}📋 Lead Count Summary:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
for workspace in "${WORKSPACE_ARRAY[@]}"; do
  COUNT=$(get_lead_count "$workspace")
  if [ "$COUNT" -gt 0 ]; then
    printf "${GREEN}%-35s: %5s leads${NC}\n" "$workspace" "$COUNT"
  else
    printf "${YELLOW}%-35s: %5s leads${NC}\n" "$workspace" "$COUNT"
  fi
done

echo ""
echo -e "${GREEN}✅ Sequential verified sync complete!${NC}"
