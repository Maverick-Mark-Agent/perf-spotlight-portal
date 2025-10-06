#!/bin/bash

# BATCH LEAD SYNC SCRIPT
# Reads audit report and syncs missing leads for all clients with gaps
# Uses the documented process from EMAIL_BISON_INTERESTED_LEADS.md

set -e

# Configuration
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if audit report is provided
if [ $# -eq 0 ]; then
  echo -e "${RED}Usage: $0 <audit-report.json>${NC}"
  echo ""
  echo "Example:"
  echo "  $0 scripts/audit-report-20251006-120953.json"
  exit 1
fi

AUDIT_FILE="$1"

if [ ! -f "$AUDIT_FILE" ]; then
  echo -e "${RED}Error: Audit file not found: ${AUDIT_FILE}${NC}"
  exit 1
fi

echo "============================================"
echo "  BATCH LEAD SYNC"
echo "  $(date)"
echo "============================================"
echo ""
echo "Audit file: ${AUDIT_FILE}"
echo ""

# Extract clients needing lead sync (gap > 0)
CLIENTS_NEEDING_SYNC=$(jq -r '.clients[] |
  select(.gap > 0) |
  @base64' "$AUDIT_FILE")

if [ -z "$CLIENTS_NEEDING_SYNC" ]; then
  echo -e "${GREEN}✓ No clients need lead sync!${NC}"
  exit 0
fi

CLIENT_COUNT=$(echo "$CLIENTS_NEEDING_SYNC" | wc -l | xargs)
echo -e "${YELLOW}Found ${CLIENT_COUNT} clients needing lead sync${NC}"
echo ""

TOTAL_LEADS_SYNCED=0
TOTAL_ERRORS=0
CLIENTS_SYNCED=0
CLIENTS_FAILED=0
RESULTS='[]'

# Process each client
INDEX=0
for client_b64 in $CLIENTS_NEEDING_SYNC; do
  ((INDEX++))

  # Decode client data
  CLIENT=$(echo "$client_b64" | base64 --decode)

  COMPANY_NAME=$(echo "$CLIENT" | jq -r '.company_name')
  WORKSPACE_NAME=$(echo "$CLIENT" | jq -r '.workspace_name')
  WORKSPACE_ID=$(echo "$CLIENT" | jq -r '.workspace_id')
  GAP=$(echo "$CLIENT" | jq -r '.gap')

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}[${INDEX}/${CLIENT_COUNT}] ${COMPANY_NAME}${NC}"
  echo -e "Workspace: ${WORKSPACE_NAME} (ID: ${WORKSPACE_ID})"
  echo -e "Gap: ${GAP} leads to sync"

  # Step 1: Switch to workspace
  echo -e "  ${BLUE}[1/6] Switching to workspace...${NC}"
  SWITCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"team_id\": ${WORKSPACE_ID}}")

  if ! echo "$SWITCH_RESPONSE" | jq -e '.data.name' > /dev/null 2>&1; then
    echo -e "  ${RED}✗ Failed to switch workspace${NC}"
    ((CLIENTS_FAILED++))

    RESULT=$(jq -n \
      --arg name "$COMPANY_NAME" \
      --argjson wid "$WORKSPACE_ID" \
      --arg status "failed" \
      --arg reason "Workspace switch failed" \
      '{
        company_name: $name,
        workspace_id: $wid,
        status: $status,
        reason: $reason,
        leads_synced: 0,
        errors: 0
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    echo ""
    continue
  fi

  sleep 1

  # Step 2: Get total count of interested replies
  echo -e "  ${BLUE}[2/6] Counting interested replies...${NC}"
  COUNT_RESPONSE=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=1" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  TOTAL_REPLIES=$(echo "$COUNT_RESPONSE" | jq -r '.meta.total // 0')
  TOTAL_PAGES=$(echo "$COUNT_RESPONSE" | jq -r '.meta.last_page // 0')

  if [ "$TOTAL_REPLIES" == "0" ]; then
    echo -e "  ${YELLOW}⚠ No interested replies found${NC}"
    ((CLIENTS_SYNCED++))

    RESULT=$(jq -n \
      --arg name "$COMPANY_NAME" \
      --argjson wid "$WORKSPACE_ID" \
      --arg status "completed" \
      '{
        company_name: $name,
        workspace_id: $wid,
        status: $status,
        leads_synced: 0,
        errors: 0
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    echo ""
    continue
  fi

  echo -e "  Found ${CYAN}${TOTAL_REPLIES}${NC} interested replies (${TOTAL_PAGES} pages)"

  # Step 3: Fetch all interested replies (paginated)
  echo -e "  ${BLUE}[3/6] Fetching all replies...${NC}"
  ALL_LEAD_IDS=()

  for page in $(seq 1 $TOTAL_PAGES); do
    echo -ne "  Fetching page ${page}/${TOTAL_PAGES}...\r"

    PAGE_RESPONSE=$(curl -s -G "${BASE_URL}/replies" \
      --data-urlencode "status=interested" \
      --data-urlencode "per_page=100" \
      --data-urlencode "page=${page}" \
      -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

    # Extract lead IDs from this page
    PAGE_LEAD_IDS=$(echo "$PAGE_RESPONSE" | jq -r '.data[].lead_id')

    while IFS= read -r lead_id; do
      if [ -n "$lead_id" ] && [ "$lead_id" != "null" ]; then
        ALL_LEAD_IDS+=("$lead_id")
      fi
    done <<< "$PAGE_LEAD_IDS"

    sleep 0.2  # Rate limiting
  done

  echo -e "  ${GREEN}✓ Fetched ${#ALL_LEAD_IDS[@]} lead IDs${NC}               "

  # Step 4: Get unique lead IDs
  echo -e "  ${BLUE}[4/6] Deduplicating lead IDs...${NC}"
  UNIQUE_LEAD_IDS=($(printf '%s\n' "${ALL_LEAD_IDS[@]}" | sort -u))
  echo -e "  ${GREEN}✓ ${#UNIQUE_LEAD_IDS[@]} unique leads${NC}"

  # Step 5: Fetch lead details and sync
  echo -e "  ${BLUE}[5/6] Fetching lead details and syncing...${NC}"
  LEADS_SYNCED=0
  SYNC_ERRORS=0

  for lead_id in "${UNIQUE_LEAD_IDS[@]}"; do
    echo -ne "  Syncing lead ${LEADS_SYNCED}/${#UNIQUE_LEAD_IDS[@]}...\r"

    # Fetch full lead details
    LEAD_RESPONSE=$(curl -s -X GET "${BASE_URL}/leads/${lead_id}" \
      -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

    # Check if lead fetch was successful
    if ! echo "$LEAD_RESPONSE" | jq -e '.data.id' > /dev/null 2>&1; then
      ((SYNC_ERRORS++))
      sleep 0.2
      continue
    fi

    # Extract lead data
    LEAD_DATA=$(echo "$LEAD_RESPONSE" | jq -r '.data')
    LEAD_EMAIL=$(echo "$LEAD_DATA" | jq -r '.email // empty')

    # Skip if no email
    if [ -z "$LEAD_EMAIL" ] || [ "$LEAD_EMAIL" == "null" ]; then
      ((SYNC_ERRORS++))
      sleep 0.2
      continue
    fi

    FIRST_NAME=$(echo "$LEAD_DATA" | jq -r '.first_name // ""')
    LAST_NAME=$(echo "$LEAD_DATA" | jq -r '.last_name // ""')
    COMPANY=$(echo "$LEAD_DATA" | jq -r '.company // ""')
    TITLE=$(echo "$LEAD_DATA" | jq -r '.title // ""')
    BISON_LEAD_ID=$(echo "$LEAD_DATA" | jq -r '.id')

    # Get phone from custom variables
    PHONE=$(echo "$LEAD_DATA" | jq -r '.custom_variables[] | select(.name == "Phone" or .name == "phone") | .value // ""' | head -1)

    # Create payload for database
    PAYLOAD=$(jq -n \
      --arg ws "$WORKSPACE_NAME" \
      --arg email "$LEAD_EMAIL" \
      --arg fname "$FIRST_NAME" \
      --arg lname "$LAST_NAME" \
      --arg company "$COMPANY" \
      --arg title "$TITLE" \
      --arg phone "$PHONE" \
      --arg bison_id "$BISON_LEAD_ID" \
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
    DB_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/client_leads" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: resolution=merge-duplicates" \
      -d "$PAYLOAD")

    # Check for database errors
    if echo "$DB_RESPONSE" | jq -e 'has("error")' > /dev/null 2>&1; then
      ((SYNC_ERRORS++))
    else
      ((LEADS_SYNCED++))
    fi

    sleep 0.2  # Rate limiting
  done

  echo -e "  ${GREEN}✓ Synced ${LEADS_SYNCED} leads (${SYNC_ERRORS} errors)${NC}                    "

  # Step 6: Verify sync
  echo -e "  ${BLUE}[6/6] Verifying sync...${NC}"
  DB_COUNT_RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.${WORKSPACE_NAME// /%20}&interested=eq.true&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}")

  DB_COUNT=$(echo "$DB_COUNT_RESPONSE" | jq -r '.[0].count // 0')
  echo -e "  Database now has ${CYAN}${DB_COUNT}${NC} interested leads"

  ((TOTAL_LEADS_SYNCED += LEADS_SYNCED))
  ((TOTAL_ERRORS += SYNC_ERRORS))
  ((CLIENTS_SYNCED++))

  RESULT=$(jq -n \
    --arg name "$COMPANY_NAME" \
    --argjson wid "$WORKSPACE_ID" \
    --arg status "completed" \
    --argjson synced "$LEADS_SYNCED" \
    --argjson errors "$SYNC_ERRORS" \
    --argjson db_count "$DB_COUNT" \
    '{
      company_name: $name,
      workspace_id: $wid,
      status: $status,
      leads_synced: $synced,
      errors: $errors,
      database_count: $db_count
    }')
  RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")

  echo ""
  sleep 2  # Rate limiting between clients
done

# Generate report
REPORT_FILE="$(dirname "$AUDIT_FILE")/sync-report-$(date +%Y%m%d-%H%M%S).json"

REPORT=$(jq -n \
  --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --argjson total "$CLIENT_COUNT" \
  --argjson synced "$CLIENTS_SYNCED" \
  --argjson failed "$CLIENTS_FAILED" \
  --argjson leads "$TOTAL_LEADS_SYNCED" \
  --argjson errors "$TOTAL_ERRORS" \
  --argjson results "$RESULTS" \
  '{
    sync_date: $timestamp,
    summary: {
      total_clients: $total,
      clients_synced: $synced,
      clients_failed: $failed,
      total_leads_synced: $leads,
      total_errors: $errors
    },
    results: $results
  }')

echo "$REPORT" | jq '.' > "$REPORT_FILE"

# Print summary
echo "============================================"
echo -e "${GREEN}BATCH SYNC COMPLETE${NC}"
echo "============================================"
echo ""
echo "Summary:"
echo "  Total clients: ${CLIENT_COUNT}"
echo -e "  ${GREEN}✓ Synced: ${CLIENTS_SYNCED}${NC}"
echo -e "  ${RED}✗ Failed: ${CLIENTS_FAILED}${NC}"
echo "  Total leads synced: ${TOTAL_LEADS_SYNCED}"
echo "  Total errors: ${TOTAL_ERRORS}"
echo ""
echo "Report saved to:"
echo "  ${REPORT_FILE}"
echo ""
echo "Next steps:"
echo "  1. Review report: cat ${REPORT_FILE} | jq '.results'"
echo "  2. Re-run audit: ./scripts/audit-all-workspaces.sh"
echo "  3. Verify gaps are closed"
echo ""
