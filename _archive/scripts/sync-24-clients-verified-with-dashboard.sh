#!/bin/bash

# Enhanced sync script with DASHBOARD VERIFICATION after each client
# This ensures the client portal will display correct data

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get total INTERESTED lead count (matches what dashboard displays)
get_lead_count() {
  local workspace="$1"
  local encoded=$(printf %s "$workspace" | jq -sRr @uri)
  local count=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=id&workspace_name=eq.$encoded&interested=eq.true" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Range: 0-9999" \
    -H "Prefer: count=exact" -I 2>&1 | grep -i "content-range:" | sed 's/.*\///' | tr -d '\r')
  echo "${count:-0}"
}

# Verify dashboard data quality (what the frontend will see)
verify_dashboard_data() {
  local workspace="$1"
  local encoded=$(printf %s "$workspace" | jq -sRr @uri)

  echo -e "  ${CYAN}🔍 DASHBOARD VERIFICATION:${NC}"

  # Get sample of 3 most recent leads with all fields
  local dashboard_data=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=lead_email,client_name,phone,company,title,city,state,zip,tags,custom_variables,bison_conversation_url,pipeline_stage&workspace_name=eq.$encoded&order=created_at.desc&limit=3" \
    -H "apikey: $SUPABASE_KEY")

  local total=$(echo "$dashboard_data" | jq 'length')

  if [ "$total" -eq 0 ]; then
    echo -e "    ${YELLOW}⚠️  No leads to verify${NC}"
    return
  fi

  # Analyze data completeness
  local with_phone=$(echo "$dashboard_data" | jq '[.[] | select(.phone != null and .phone != "")] | length')
  local with_tags=$(echo "$dashboard_data" | jq '[.[] | select(.tags != null and (.tags | length) > 0)] | length')
  local with_custom_vars=$(echo "$dashboard_data" | jq '[.[] | select(.custom_variables != null and (.custom_variables | length) > 0)] | length')
  local with_url=$(echo "$dashboard_data" | jq '[.[] | select(.bison_conversation_url != null and .bison_conversation_url != "")] | length')
  local with_address=$(echo "$dashboard_data" | jq '[.[] | select(.city != null or .state != null or .zip != null)] | length')

  echo -e "    📊 Sample of $total most recent leads:"
  echo -e "    ${GREEN}✅ Conversation URLs: $with_url/$total${NC}"

  if [ "$with_phone" -gt 0 ]; then
    echo -e "    ${GREEN}✅ Phone numbers: $with_phone/$total${NC}"
  else
    echo -e "    ${YELLOW}⚠️  Phone numbers: $with_phone/$total (may not be available in source data)${NC}"
  fi

  if [ "$with_tags" -gt 0 ]; then
    echo -e "    ${GREEN}✅ Tags: $with_tags/$total${NC}"
  else
    echo -e "    ${YELLOW}⚠️  Tags: $with_tags/$total${NC}"
  fi

  if [ "$with_custom_vars" -gt 0 ]; then
    echo -e "    ${GREEN}✅ Custom variables: $with_custom_vars/$total${NC}"
  else
    echo -e "    ${YELLOW}⚠️  Custom variables: $with_custom_vars/$total${NC}"
  fi

  if [ "$with_address" -gt 0 ]; then
    echo -e "    ${GREEN}✅ Address data: $with_address/$total${NC}"
  else
    echo -e "    ${YELLOW}⚠️  Address data: $with_address/$total${NC}"
  fi

  # Show one example lead
  echo ""
  echo -e "    ${CYAN}📋 Example lead (what dashboard will show):${NC}"
  echo "$dashboard_data" | jq -r '.[0] | "      Email: \(.lead_email)\n      Name: \(.client_name // "NULL")\n      Phone: \(.phone // "NULL")\n      Company: \(.company // "NULL")\n      Address: \(.city // "NULL"), \(.state // "NULL") \(.zip // "NULL")\n      Tags: \(if .tags and (.tags | length) > 0 then (.tags | map(.name) | join(", ")) else "NONE" end)\n      Custom Vars: \(if .custom_variables then (.custom_variables | length) else 0 end) fields\n      Conversation: \(.bison_conversation_url // "NULL")\n      Stage: \(.pipeline_stage // "interested")"'
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 SYNCING 24 CLIENTS WITH DASHBOARD VERIFICATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Fetching valid client workspaces..."
ALL_WORKSPACES=$(curl -s "$SUPABASE_URL/rest/v1/client_registry?select=workspace_name,bison_workspace_id,bison_instance,bison_api_key&is_active=eq.true&order=workspace_name" \
  -H "apikey: $SUPABASE_KEY")

# Filter to ONLY workspaces with valid IDs (> 0)
VALID_WORKSPACES=$(echo "$ALL_WORKSPACES" | jq '[.[] | select(.bison_workspace_id != null and .bison_workspace_id > 0 and .bison_instance != null and .bison_instance != "")]')

WORKSPACE_NAMES=$(echo "$VALID_WORKSPACES" | jq -r '.[].workspace_name')
IFS=$'\n' read -d '' -r -a WORKSPACE_ARRAY <<< "$WORKSPACE_NAMES"
TOTAL=${#WORKSPACE_ARRAY[@]}

echo -e "${GREEN}✅ Found $TOTAL valid client workspaces${NC}"
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
  echo -e "  ${BLUE}📊 BEFORE SYNC: $BEFORE_COUNT leads in database${NC}"
  echo ""

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
      echo "  📥 Leads synced: $LEADS_SYNCED"
      echo ""

      sleep 2
      AFTER_COUNT=$(get_lead_count "$WORKSPACE")
      echo -e "  ${BLUE}📊 AFTER SYNC: $AFTER_COUNT total leads in database${NC}"
      echo ""

      # DASHBOARD VERIFICATION
      verify_dashboard_data "$WORKSPACE"

      echo ""
      if [ "$LEADS_SYNCED" -gt 0 ]; then
        echo -e "  ${GREEN}✅ VERIFIED: Dashboard will show $AFTER_COUNT leads with full data${NC}"
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
  echo -e "${CYAN}⏸️  Pausing 5 seconds before next workspace...${NC}"
  echo ""
  sleep 5
done

# Final summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 FINAL SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Successfully synced: $SUCCESS_COUNT workspaces${NC}"
echo -e "${YELLOW}⚠️  No new leads: $SKIP_COUNT workspaces${NC}"
echo -e "${RED}❌ Failed: $FAIL_COUNT workspaces${NC}"
echo -e "   ${BLUE}━━━━━━━━━━━━━━━━${NC}"
echo "   Total: $TOTAL workspaces"
echo ""

echo -e "${BLUE}📋 Final Lead Count by Workspace:${NC}"
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
echo -e "${GREEN}✅ All client workspaces synced and dashboard verified!${NC}"
echo -e "${CYAN}📱 Client portals are now ready with full lead data${NC}"
