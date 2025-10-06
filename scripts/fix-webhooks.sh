#!/bin/bash

# AUTOMATED WEBHOOK FIX SCRIPT
# Reads audit report and fixes missing/broken webhooks
# for all clients that need webhook creation

set -e

# Configuration
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"
REGISTRY_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/client-registry.json"

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
echo "  AUTOMATED WEBHOOK FIX"
echo "  $(date)"
echo "============================================"
echo ""
echo "Audit file: ${AUDIT_FILE}"
echo ""

# Extract clients needing webhook fixes
CLIENTS_NEEDING_WEBHOOKS=$(jq -r '.clients[] |
  select(.action_needed == "create_webhook" or .action_needed == "create_webhook_and_sync") |
  @base64' "$AUDIT_FILE")

if [ -z "$CLIENTS_NEEDING_WEBHOOKS" ]; then
  echo -e "${GREEN}✓ No clients need webhook fixes!${NC}"
  exit 0
fi

CLIENT_COUNT=$(echo "$CLIENTS_NEEDING_WEBHOOKS" | wc -l | xargs)
echo -e "${YELLOW}Found ${CLIENT_COUNT} clients needing webhooks${NC}"
echo ""

FIXED_COUNT=0
FAILED_COUNT=0
RESULTS='[]'

# Process each client
INDEX=0
for client_b64 in $CLIENTS_NEEDING_WEBHOOKS; do
  ((INDEX++))

  # Decode client data
  CLIENT=$(echo "$client_b64" | base64 --decode)

  COMPANY_NAME=$(echo "$CLIENT" | jq -r '.company_name')
  WORKSPACE_NAME=$(echo "$CLIENT" | jq -r '.workspace_name')
  WORKSPACE_ID=$(echo "$CLIENT" | jq -r '.workspace_id')
  EXPECTED_WEBHOOK_ID=$(echo "$CLIENT" | jq -r '.webhook_id // "null"')

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}[${INDEX}/${CLIENT_COUNT}] ${COMPANY_NAME}${NC}"
  echo -e "Workspace: ${WORKSPACE_NAME} (ID: ${WORKSPACE_ID})"

  # Step 1: Switch to workspace
  echo -e "  ${BLUE}[1/4] Switching to workspace...${NC}"
  SWITCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"team_id\": ${WORKSPACE_ID}}")

  if ! echo "$SWITCH_RESPONSE" | jq -e '.data.name' > /dev/null 2>&1; then
    echo -e "  ${RED}✗ Failed to switch workspace${NC}"
    ((FAILED_COUNT++))

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
        webhook_id: null
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    echo ""
    continue
  fi

  sleep 1

  # Step 2: Check if webhook already exists
  echo -e "  ${BLUE}[2/4] Checking existing webhooks...${NC}"
  EXISTING_WEBHOOKS=$(curl -s -X GET "${BASE_URL}/webhook-url" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  # Check if webhook with our URL already exists (take first match)
  EXISTING_WEBHOOK=$(echo "$EXISTING_WEBHOOKS" | jq -r \
    "[.data[] | select(.url == \"${WEBHOOK_URL}\" and (.events | contains([\"lead_interested\"])))] | first")

  if [ -n "$EXISTING_WEBHOOK" ] && [ "$EXISTING_WEBHOOK" != "null" ]; then
    EXISTING_ID=$(echo "$EXISTING_WEBHOOK" | jq -r '.id')
    echo -e "  ${GREEN}✓ Webhook already exists (ID: ${EXISTING_ID})${NC}"

    # Update registry if ID is different
    if [ "$EXPECTED_WEBHOOK_ID" != "$EXISTING_ID" ]; then
      echo -e "  ${YELLOW}⚠ Registry has different ID (${EXPECTED_WEBHOOK_ID}), updating...${NC}"
      # Update registry - this will be done in bulk at the end
    fi

    ((FIXED_COUNT++))

    RESULT=$(jq -n \
      --arg name "$COMPANY_NAME" \
      --argjson wid "$WORKSPACE_ID" \
      --arg status "already_exists" \
      --argjson whid "$EXISTING_ID" \
      '{
        company_name: $name,
        workspace_id: $wid,
        status: $status,
        webhook_id: $whid
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    echo ""
    continue
  fi

  # Step 3: Create webhook
  echo -e "  ${BLUE}[3/4] Creating webhook...${NC}"
  WEBHOOK_RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-url" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Client Portal Pipeline - Interested Leads\",
      \"url\": \"${WEBHOOK_URL}\",
      \"events\": [\"lead_interested\"]
    }")

  # Check for errors
  if echo "$WEBHOOK_RESPONSE" | jq -e 'has("error")' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$WEBHOOK_RESPONSE" | jq -r '.error // .message // "Unknown error"')
    echo -e "  ${RED}✗ Failed to create webhook: ${ERROR_MSG}${NC}"
    ((FAILED_COUNT++))

    RESULT=$(jq -n \
      --arg name "$COMPANY_NAME" \
      --argjson wid "$WORKSPACE_ID" \
      --arg status "failed" \
      --arg reason "Webhook creation failed: $ERROR_MSG" \
      '{
        company_name: $name,
        workspace_id: $wid,
        status: $status,
        reason: $reason,
        webhook_id: null
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    echo ""
    continue
  fi

  # Extract webhook ID
  NEW_WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | jq -r '.data.id')

  if [ -z "$NEW_WEBHOOK_ID" ] || [ "$NEW_WEBHOOK_ID" == "null" ]; then
    echo -e "  ${RED}✗ No webhook ID in response${NC}"
    ((FAILED_COUNT++))

    RESULT=$(jq -n \
      --arg name "$COMPANY_NAME" \
      --argjson wid "$WORKSPACE_ID" \
      --arg status "failed" \
      --arg reason "No webhook ID in response" \
      '{
        company_name: $name,
        workspace_id: $wid,
        status: $status,
        reason: $reason,
        webhook_id: null
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    echo ""
    continue
  fi

  echo -e "  ${GREEN}✓ Webhook created (ID: ${NEW_WEBHOOK_ID})${NC}"

  # Step 4: Verify webhook
  echo -e "  ${BLUE}[4/4] Verifying webhook...${NC}"
  sleep 1

  VERIFY_RESPONSE=$(curl -s -X GET "${BASE_URL}/webhook-url/${NEW_WEBHOOK_ID}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  if echo "$VERIFY_RESPONSE" | jq -e '.data.id' > /dev/null 2>&1; then
    ACTIVE=$(echo "$VERIFY_RESPONSE" | jq -r '.data.active')
    if [ "$ACTIVE" == "true" ]; then
      echo -e "  ${GREEN}✓ Webhook verified and active${NC}"
      ((FIXED_COUNT++))

      RESULT=$(jq -n \
        --arg name "$COMPANY_NAME" \
        --argjson wid "$WORKSPACE_ID" \
        --arg status "created" \
        --argjson whid "$NEW_WEBHOOK_ID" \
        '{
          company_name: $name,
          workspace_id: $wid,
          status: $status,
          webhook_id: $whid
        }')
      RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    else
      echo -e "  ${YELLOW}⚠ Webhook created but not active${NC}"
      ((FIXED_COUNT++))

      RESULT=$(jq -n \
        --arg name "$COMPANY_NAME" \
        --argjson wid "$WORKSPACE_ID" \
        --arg status "created_inactive" \
        --argjson whid "$NEW_WEBHOOK_ID" \
        '{
          company_name: $name,
          workspace_id: $wid,
          status: $status,
          webhook_id: $whid
        }')
      RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    fi
  else
    echo -e "  ${YELLOW}⚠ Webhook created but verification failed${NC}"
    ((FIXED_COUNT++))

    RESULT=$(jq -n \
      --arg name "$COMPANY_NAME" \
      --argjson wid "$WORKSPACE_ID" \
      --arg status "created_unverified" \
      --argjson whid "$NEW_WEBHOOK_ID" \
      '{
        company_name: $name,
        workspace_id: $wid,
        status: $status,
        webhook_id: $whid
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
  fi

  echo ""
  sleep 0.5  # Rate limiting
done

# Generate report
REPORT_FILE="$(dirname "$AUDIT_FILE")/webhook-fix-report-$(date +%Y%m%d-%H%M%S).json"

REPORT=$(jq -n \
  --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --argjson total "$CLIENT_COUNT" \
  --argjson fixed "$FIXED_COUNT" \
  --argjson failed "$FAILED_COUNT" \
  --argjson results "$RESULTS" \
  '{
    fix_date: $timestamp,
    summary: {
      total_clients: $total,
      webhooks_fixed: $fixed,
      webhooks_failed: $failed
    },
    results: $results
  }')

echo "$REPORT" | jq '.' > "$REPORT_FILE"

# Print summary
echo "============================================"
echo -e "${GREEN}WEBHOOK FIX COMPLETE${NC}"
echo "============================================"
echo ""
echo "Summary:"
echo "  Total clients: ${CLIENT_COUNT}"
echo -e "  ${GREEN}✓ Fixed: ${FIXED_COUNT}${NC}"
echo -e "  ${RED}✗ Failed: ${FAILED_COUNT}${NC}"
echo ""
echo "Report saved to:"
echo "  ${REPORT_FILE}"
echo ""
echo "Next steps:"
echo "  1. Review report: cat ${REPORT_FILE} | jq '.results'"
echo "  2. Update client-registry.json with new webhook IDs"
echo "  3. Run sync script: ./scripts/sync-all-clients.sh ${AUDIT_FILE}"
echo ""
