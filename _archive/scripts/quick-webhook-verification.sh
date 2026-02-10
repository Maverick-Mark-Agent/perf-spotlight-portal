#!/bin/bash

# Quick Webhook Verification Script
# Tests webhook function and checks sample clients

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"

echo "============================================"
echo "  Quick Webhook Verification"
echo "============================================"
echo ""

# Test 1: Function Accessibility
echo -e "${CYAN}[1/4] Testing webhook function accessibility...${NC}"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": true}')

if echo "$RESPONSE" | grep -q "Not a LEAD_INTERESTED event"; then
  echo -e "${GREEN}✓ Function is accessible and processing requests${NC}"
else
  echo -e "${RED}✗ Function returned unexpected response:${NC}"
  echo "$RESPONSE"
  exit 1
fi

echo ""

# Test 2: Test Webhook Delivery
echo -e "${CYAN}[2/4] Testing webhook delivery (creates test lead)...${NC}"

TEST_EMAIL="quick-verify-$(date +%s)@example.com"

TEST_PAYLOAD=$(cat <<EOF
{
  "event": {
    "type": "LEAD_INTERESTED",
    "workspace_name": "Verification Test",
    "workspace_id": 9999,
    "instance_url": "https://app.emailbison.com"
  },
  "data": {
    "lead": {
      "id": 999999,
      "email": "$TEST_EMAIL",
      "first_name": "Quick",
      "last_name": "Verification",
      "status": "interested",
      "title": "Test",
      "company": "Test Co",
      "custom_variables": []
    },
    "reply": {
      "id": 88888,
      "uuid": "quick-verify-uuid",
      "date_received": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "from_name": "Quick Verification",
      "from_email_address": "$TEST_EMAIL"
    },
    "campaign": {
      "id": 999,
      "name": "Quick Verification"
    },
    "sender_email": {
      "id": 999,
      "email": "test@test.com",
      "name": "Test"
    }
  }
}
EOF
)

WEBHOOK_RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD")

if echo "$WEBHOOK_RESPONSE" | grep -q '"success":true'; then
  LEAD_ID=$(echo "$WEBHOOK_RESPONSE" | jq -r '.lead_id')
  echo -e "${GREEN}✓ Test lead created successfully${NC}"
  echo -e "  Lead ID: $LEAD_ID"

  # Cleanup
  SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

  curl -s -X DELETE "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?id=eq.$LEAD_ID" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" > /dev/null

  echo -e "  ${YELLOW}(Test lead cleaned up)${NC}"
else
  echo -e "${RED}✗ Webhook delivery failed:${NC}"
  echo "$WEBHOOK_RESPONSE" | jq .
  exit 1
fi

echo ""

# Test 3: Sample Client Webhooks
echo -e "${CYAN}[3/4] Checking sample client webhooks...${NC}"

SAMPLE_CLIENTS=(
  "David Amiri:25:69"
  "Kim Wallace:4:93"
  "John Roberts:28:78"
  "Danny Schwartz:36:89"
  "Devin Hodo:37:76"
)

PASSED=0
FAILED=0

for client_info in "${SAMPLE_CLIENTS[@]}"; do
  IFS=':' read -r CLIENT_NAME WORKSPACE_ID EXPECTED_WEBHOOK_ID <<< "$client_info"

  echo -e "\n  Checking: ${CYAN}$CLIENT_NAME${NC}"

  # Switch workspace
  curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_id\": ${WORKSPACE_ID}}" > /dev/null

  sleep 1

  # Check webhook
  WEBHOOK_DATA=$(curl -s -X GET "${BASE_URL}/webhook-url/${EXPECTED_WEBHOOK_ID}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  if echo "$WEBHOOK_DATA" | jq -e '.data.active == true' > /dev/null 2>&1; then
    WEBHOOK_URL_CHECK=$(echo "$WEBHOOK_DATA" | jq -r '.data.url')
    if [[ "$WEBHOOK_URL_CHECK" == *"bison-interested-webhook"* ]]; then
      echo -e "    ${GREEN}✓ Active (ID: $EXPECTED_WEBHOOK_ID)${NC}"
      ((PASSED++))
    else
      echo -e "    ${YELLOW}⚠ Wrong URL: $WEBHOOK_URL_CHECK${NC}"
      ((FAILED++))
    fi
  else
    echo -e "    ${RED}✗ Not active or not found${NC}"
    ((FAILED++))
  fi
done

echo ""
echo -e "  Summary: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"

echo ""

# Test 4: Overall Status
echo -e "${CYAN}[4/4] Overall webhook system status...${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "============================================"
  echo -e "${GREEN}  WEBHOOK SYSTEM: HEALTHY${NC}"
  echo "============================================"
  echo ""
  echo "Next steps:"
  echo "  1. Run full verification: ./scripts/verify-all-webhooks.sh"
  echo "  2. Test end-to-end with real client"
  echo "  3. See rollout plan: docs/WEBHOOK_ROLLOUT_PLAN_ALL_CLIENTS.md"
else
  echo -e "${YELLOW}⚠ Some checks failed${NC}"
  echo ""
  echo "Review failures above and:"
  echo "  1. Check webhook configuration in Email Bison"
  echo "  2. Run troubleshooting: docs/runbooks/WEBHOOK_TROUBLESHOOTING.md"
  echo "  3. Contact engineering team if issues persist"
fi

echo ""
