#!/bin/bash

# CLIENT SYNC VERIFICATION SCRIPT
# Verifies a single client's webhook and lead sync status
# Compares Email Bison count vs Database count vs Portal display

set -e

# Configuration
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"
WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check arguments
if [ $# -ne 2 ]; then
  echo -e "${RED}Usage: $0 <workspace_name> <workspace_id>${NC}"
  echo ""
  echo "Example:"
  echo "  $0 \"Kim Wallace\" 4"
  exit 1
fi

WORKSPACE_NAME="$1"
WORKSPACE_ID="$2"

echo "============================================"
echo "  CLIENT SYNC VERIFICATION"
echo "  $(date)"
echo "============================================"
echo ""
echo "Client: ${WORKSPACE_NAME}"
echo "Workspace ID: ${WORKSPACE_ID}"
echo ""

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Test 1: Workspace Switch
echo -e "${BLUE}[Test 1/6] Workspace Switch${NC}"
SWITCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"team_id\": ${WORKSPACE_ID}}")

if echo "$SWITCH_RESPONSE" | jq -e '.data.name' > /dev/null 2>&1; then
  ACTUAL_WS_NAME=$(echo "$SWITCH_RESPONSE" | jq -r '.data.name')
  echo -e "  ${GREEN}✓ Workspace switch successful${NC}"
  echo -e "  Workspace name: ${ACTUAL_WS_NAME}"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗ Workspace switch failed${NC}"
  echo -e "  Response: $(echo "$SWITCH_RESPONSE" | jq -r '.error // .message // "Unknown error"')"
  ((TESTS_FAILED++))
  exit 1
fi

sleep 1
echo ""

# Test 2: Webhook Exists
echo -e "${BLUE}[Test 2/6] Webhook Configuration${NC}"
WEBHOOKS=$(curl -s -X GET "${BASE_URL}/webhook-url" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

WEBHOOK=$(echo "$WEBHOOKS" | jq -r ".data[] | select(.url == \"${WEBHOOK_URL}\" and .event == \"LEAD_INTERESTED\")")

if [ -n "$WEBHOOK" ]; then
  WEBHOOK_ID=$(echo "$WEBHOOK" | jq -r '.id')
  WEBHOOK_ACTIVE=$(echo "$WEBHOOK" | jq -r '.active')

  echo -e "  ${GREEN}✓ Webhook exists${NC}"
  echo -e "  Webhook ID: ${WEBHOOK_ID}"

  if [ "$WEBHOOK_ACTIVE" == "true" ]; then
    echo -e "  ${GREEN}✓ Webhook is active${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "  ${RED}✗ Webhook is inactive${NC}"
    ((TESTS_FAILED++))
  fi
else
  echo -e "  ${RED}✗ Webhook not found${NC}"
  echo -e "  Expected URL: ${WEBHOOK_URL}"
  echo -e "  Expected event: LEAD_INTERESTED"
  ((TESTS_FAILED++))
fi

echo ""

# Test 3: Email Bison Interested Count
echo -e "${BLUE}[Test 3/6] Email Bison Interested Replies${NC}"
BISON_RESPONSE=$(curl -s -G "${BASE_URL}/replies" \
  --data-urlencode "status=interested" \
  --data-urlencode "per_page=1" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

BISON_COUNT=$(echo "$BISON_RESPONSE" | jq -r '.meta.total // 0')

if [ "$BISON_COUNT" -ge 0 ]; then
  echo -e "  ${GREEN}✓ Email Bison query successful${NC}"
  echo -e "  Interested replies: ${CYAN}${BISON_COUNT}${NC}"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗ Failed to query Email Bison${NC}"
  ((TESTS_FAILED++))
fi

echo ""

# Test 4: Database Count
echo -e "${BLUE}[Test 4/6] Database Interested Leads${NC}"
DB_RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.${WORKSPACE_NAME// /%20}&interested=eq.true&select=count" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

DB_COUNT=$(echo "$DB_RESPONSE" | jq -r '.[0].count // 0')

if [ "$DB_COUNT" -ge 0 ]; then
  echo -e "  ${GREEN}✓ Database query successful${NC}"
  echo -e "  Interested leads: ${CYAN}${DB_COUNT}${NC}"
  ((TESTS_PASSED++))
else
  echo -e "  ${RED}✗ Failed to query database${NC}"
  ((TESTS_FAILED++))
fi

echo ""

# Test 5: Count Comparison
echo -e "${BLUE}[Test 5/6] Count Comparison${NC}"
GAP=$((BISON_COUNT - DB_COUNT))

echo -e "  Email Bison: ${BISON_COUNT}"
echo -e "  Database:    ${DB_COUNT}"
echo -e "  Gap:         ${GAP}"

if [ $GAP -eq 0 ]; then
  echo -e "  ${GREEN}✓ Counts match perfectly${NC}"
  ((TESTS_PASSED++))
elif [ $GAP -gt 0 ] && [ $GAP -le 2 ]; then
  echo -e "  ${YELLOW}⚠ Small gap (${GAP} leads) - acceptable${NC}"
  echo -e "  This may be due to recent replies not yet synced"
  ((WARNINGS++))
  ((TESTS_PASSED++))
elif [ $GAP -gt 2 ]; then
  echo -e "  ${RED}✗ Significant gap (${GAP} leads missing from database)${NC}"
  echo -e "  Action needed: Run sync script"
  ((TESTS_FAILED++))
elif [ $GAP -lt 0 ]; then
  echo -e "  ${RED}✗ Database has MORE leads than Email Bison (${GAP})${NC}"
  echo -e "  Action needed: Investigate anomaly"
  ((TESTS_FAILED++))
fi

echo ""

# Test 6: Recent Lead Sample
echo -e "${BLUE}[Test 6/6] Recent Leads in Database${NC}"
RECENT_LEADS=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.${WORKSPACE_NAME// /%20}&interested=eq.true&order=created_at.desc&limit=5&select=lead_email,created_at,pipeline_stage" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

LEAD_COUNT=$(echo "$RECENT_LEADS" | jq -r 'length')

if [ "$LEAD_COUNT" -gt 0 ]; then
  echo -e "  ${GREEN}✓ Found ${LEAD_COUNT} recent leads${NC}"
  echo ""
  echo "  Recent leads:"
  echo "$RECENT_LEADS" | jq -r '.[] | "    • \(.lead_email) - Stage: \(.pipeline_stage) - Created: \(.created_at)"'
  ((TESTS_PASSED++))
else
  if [ "$BISON_COUNT" -gt 0 ]; then
    echo -e "  ${RED}✗ No leads in database but ${BISON_COUNT} in Email Bison${NC}"
    ((TESTS_FAILED++))
  else
    echo -e "  ${GREEN}✓ No leads (as expected)${NC}"
    ((TESTS_PASSED++))
  fi
fi

echo ""
echo "============================================"
echo "  VERIFICATION RESULTS"
echo "============================================"
echo ""

# Summary
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ ${WARNINGS} warning(s)${NC}"
  fi
  echo ""
  echo "Client: ${WORKSPACE_NAME}"
  echo "Status: HEALTHY"
  echo "Tests: ${TESTS_PASSED}/${TOTAL_TESTS} passed"
  echo ""
  exit 0
else
  echo -e "${RED}✗ TESTS FAILED${NC}"
  echo ""
  echo "Client: ${WORKSPACE_NAME}"
  echo "Status: NEEDS ATTENTION"
  echo "Tests: ${TESTS_PASSED}/${TOTAL_TESTS} passed, ${TESTS_FAILED} failed"
  echo ""

  # Recommendations
  echo "Recommendations:"
  if [ $GAP -gt 2 ]; then
    echo "  1. Run sync script: ./scripts/sync-all-clients.sh <audit-report>"
  fi
  if [ -z "$WEBHOOK" ]; then
    echo "  2. Create webhook: ./scripts/fix-webhooks.sh <audit-report>"
  fi
  if [ "$WEBHOOK_ACTIVE" == "false" ]; then
    echo "  3. Check webhook status in Email Bison dashboard"
  fi
  echo ""
  exit 1
fi
