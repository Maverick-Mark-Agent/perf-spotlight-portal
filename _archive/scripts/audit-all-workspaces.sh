#!/bin/bash

# COMPREHENSIVE EMAIL BISON WORKSPACE AUDIT
# Checks all clients for:
# - Webhook configuration and status
# - Lead count comparison (Email Bison vs Database)
# - Identifies sync gaps and missing webhooks

set -e

# Configuration
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"
REGISTRY_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/client-registry.json"
OUTPUT_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/audit-report-$(date +%Y%m%d-%H%M%S).json"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  EMAIL BISON WORKSPACE AUDIT"
echo "  $(date)"
echo "============================================"
echo ""

# Read client registry
if [ ! -f "$REGISTRY_FILE" ]; then
  echo -e "${RED}Error: client-registry.json not found${NC}"
  exit 1
fi

TOTAL_CLIENTS=$(jq '.clients | length' "$REGISTRY_FILE")
echo -e "${BLUE}Total clients in registry: ${TOTAL_CLIENTS}${NC}"
echo ""

# Initialize counters
WEBHOOKS_OK=0
WEBHOOKS_MISSING=0
WEBHOOKS_BROKEN=0
NEEDS_SYNC=0
CLIENTS_PROCESSED=0

# Initialize results array
RESULTS='[]'

# Process each client
for i in $(seq 0 $((TOTAL_CLIENTS - 1))); do
  CLIENT=$(jq ".clients[$i]" "$REGISTRY_FILE")

  COMPANY_NAME=$(echo "$CLIENT" | jq -r '.company_name')
  WORKSPACE_NAME=$(echo "$CLIENT" | jq -r '.workspace_name')
  WORKSPACE_ID=$(echo "$CLIENT" | jq -r '.workspace_id')
  WEBHOOK_ID=$(echo "$CLIENT" | jq -r '.webhook_id')
  STATUS=$(echo "$CLIENT" | jq -r '.status')

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}[$((i+1))/${TOTAL_CLIENTS}] ${COMPANY_NAME}${NC}"
  echo -e "Workspace: ${WORKSPACE_NAME} (ID: ${WORKSPACE_ID})"
  echo -e "Status: ${STATUS}"

  # Skip if no workspace
  if [ "$WORKSPACE_ID" == "null" ] || [ -z "$WORKSPACE_ID" ]; then
    echo -e "${RED}⊘ No workspace - SKIPPED${NC}"
    RESULT=$(jq -n \
      --arg name "$COMPANY_NAME" \
      --arg workspace "$WORKSPACE_NAME" \
      --arg status "skipped" \
      --arg reason "No workspace ID" \
      '{
        company_name: $name,
        workspace_name: $workspace,
        workspace_id: null,
        status: $status,
        reason: $reason,
        webhook_status: "n/a",
        email_bison_count: 0,
        database_count: 0,
        gap: 0,
        action_needed: "none"
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    echo ""
    continue
  fi

  ((CLIENTS_PROCESSED++))

  # Switch to workspace
  echo -e "  ${BLUE}Switching to workspace...${NC}"
  SWITCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"team_id\": ${WORKSPACE_ID}}")

  if ! echo "$SWITCH_RESPONSE" | jq -e '.data.name' > /dev/null 2>&1; then
    echo -e "  ${RED}✗ Failed to switch workspace${NC}"
    RESULT=$(jq -n \
      --arg name "$COMPANY_NAME" \
      --arg workspace "$WORKSPACE_NAME" \
      --argjson wid "$WORKSPACE_ID" \
      --arg status "error" \
      --arg reason "Workspace switch failed" \
      '{
        company_name: $name,
        workspace_name: $workspace,
        workspace_id: $wid,
        status: $status,
        reason: $reason,
        webhook_status: "unknown",
        email_bison_count: 0,
        database_count: 0,
        gap: 0,
        action_needed: "investigate"
      }')
    RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
    echo ""
    continue
  fi

  sleep 1

  # Check webhook status
  echo -e "  ${BLUE}Checking webhook...${NC}"
  WEBHOOK_STATUS="missing"
  WEBHOOK_DETAILS=""

  if [ "$WEBHOOK_ID" != "null" ] && [ -n "$WEBHOOK_ID" ]; then
    # List all webhooks to verify
    WEBHOOKS=$(curl -s -X GET "${BASE_URL}/webhook-url" \
      -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

    WEBHOOK=$(echo "$WEBHOOKS" | jq ".data[] | select(.id == $WEBHOOK_ID)")

    if [ -n "$WEBHOOK" ]; then
      WEBHOOK_URL=$(echo "$WEBHOOK" | jq -r '.url')
      WEBHOOK_EVENT=$(echo "$WEBHOOK" | jq -r '.events[0]')

      if [ "$WEBHOOK_URL" == "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook" ] && \
         [ "$WEBHOOK_EVENT" == "lead_interested" ]; then
        WEBHOOK_STATUS="active"
        echo -e "  ${GREEN}✓ Webhook $WEBHOOK_ID active${NC}"
        ((WEBHOOKS_OK++))
      else
        WEBHOOK_STATUS="incorrect"
        echo -e "  ${YELLOW}⚠ Webhook $WEBHOOK_ID exists but incorrect config${NC}"
        echo -e "    URL: $WEBHOOK_URL"
        echo -e "    Event: $WEBHOOK_EVENT"
        ((WEBHOOKS_BROKEN++))
      fi
    else
      WEBHOOK_STATUS="missing"
      echo -e "  ${RED}✗ Webhook $WEBHOOK_ID not found${NC}"
      ((WEBHOOKS_MISSING++))
    fi
  else
    echo -e "  ${RED}✗ No webhook ID in registry${NC}"
    ((WEBHOOKS_MISSING++))
  fi

  # Count interested replies in Email Bison
  echo -e "  ${BLUE}Counting Email Bison interested replies...${NC}"
  BISON_RESPONSE=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=1" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  BISON_COUNT=$(echo "$BISON_RESPONSE" | jq -r '.meta.total // 0')
  echo -e "  Email Bison: ${CYAN}${BISON_COUNT}${NC} interested replies"

  # Count interested leads in database
  echo -e "  ${BLUE}Counting database leads...${NC}"
  DB_RESPONSE=$(curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?workspace_name=eq.${WORKSPACE_NAME// /%20}&interested=eq.true&select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}")

  DB_COUNT=$(echo "$DB_RESPONSE" | jq -r '.[0].count // 0')
  echo -e "  Database: ${CYAN}${DB_COUNT}${NC} interested leads"

  # Calculate gap
  GAP=$((BISON_COUNT - DB_COUNT))

  if [ $GAP -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Gap: ${GAP} leads need sync${NC}"
    ((NEEDS_SYNC++))
    ACTION="sync_leads"
  elif [ $GAP -lt 0 ]; then
    echo -e "  ${RED}⚠ Database has MORE leads than Email Bison (${GAP})${NC}"
    ACTION="investigate"
  else
    echo -e "  ${GREEN}✓ Counts match${NC}"
    ACTION="none"
  fi

  # Determine overall action needed
  if [ "$WEBHOOK_STATUS" == "missing" ]; then
    if [ $GAP -gt 0 ]; then
      ACTION="create_webhook_and_sync"
    else
      ACTION="create_webhook"
    fi
  elif [ "$WEBHOOK_STATUS" == "incorrect" ]; then
    if [ $GAP -gt 0 ]; then
      ACTION="fix_webhook_and_sync"
    else
      ACTION="fix_webhook"
    fi
  fi

  # Build result object
  RESULT=$(jq -n \
    --arg name "$COMPANY_NAME" \
    --arg workspace "$WORKSPACE_NAME" \
    --argjson wid "$WORKSPACE_ID" \
    --argjson whid "${WEBHOOK_ID:-null}" \
    --arg wh_status "$WEBHOOK_STATUS" \
    --argjson bison "$BISON_COUNT" \
    --argjson db "$DB_COUNT" \
    --argjson gap "$GAP" \
    --arg action "$ACTION" \
    --arg client_status "$STATUS" \
    '{
      company_name: $name,
      workspace_name: $workspace,
      workspace_id: $wid,
      webhook_id: $whid,
      webhook_status: $wh_status,
      email_bison_count: $bison,
      database_count: $db,
      gap: $gap,
      action_needed: $action,
      client_status: $client_status
    }')

  RESULTS=$(echo "$RESULTS" | jq ". += [$RESULT]")
  echo ""

  sleep 0.5  # Rate limiting
done

# Build final report
REPORT=$(jq -n \
  --argjson total "$TOTAL_CLIENTS" \
  --argjson processed "$CLIENTS_PROCESSED" \
  --argjson wh_ok "$WEBHOOKS_OK" \
  --argjson wh_missing "$WEBHOOKS_MISSING" \
  --argjson wh_broken "$WEBHOOKS_BROKEN" \
  --argjson needs_sync "$NEEDS_SYNC" \
  --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --argjson clients "$RESULTS" \
  '{
    audit_date: $timestamp,
    summary: {
      total_clients: $total,
      clients_processed: $processed,
      webhooks_ok: $wh_ok,
      webhooks_missing: $wh_missing,
      webhooks_broken: $wh_broken,
      clients_need_sync: $needs_sync
    },
    clients: $clients
  }')

# Write report
echo "$REPORT" | jq '.' > "$OUTPUT_FILE"

# Print summary
echo "============================================"
echo -e "${GREEN}AUDIT COMPLETE${NC}"
echo "============================================"
echo ""
echo "Summary:"
echo "  Total clients: ${TOTAL_CLIENTS}"
echo "  Processed: ${CLIENTS_PROCESSED}"
echo ""
echo "Webhook Status:"
echo -e "  ${GREEN}✓ Active: ${WEBHOOKS_OK}${NC}"
echo -e "  ${RED}✗ Missing: ${WEBHOOKS_MISSING}${NC}"
echo -e "  ${YELLOW}⚠ Broken: ${WEBHOOKS_BROKEN}${NC}"
echo ""
echo "Lead Sync:"
echo -e "  ${YELLOW}Clients needing sync: ${NEEDS_SYNC}${NC}"
echo ""
echo "Report saved to:"
echo "  ${OUTPUT_FILE}"
echo ""
echo "Next steps:"
echo "  1. Review report: cat ${OUTPUT_FILE} | jq '.clients[] | select(.action_needed != \"none\")'"
echo "  2. Fix webhooks: ./scripts/fix-webhooks.sh ${OUTPUT_FILE}"
echo "  3. Sync leads: ./scripts/sync-all-clients.sh ${OUTPUT_FILE}"
echo ""
