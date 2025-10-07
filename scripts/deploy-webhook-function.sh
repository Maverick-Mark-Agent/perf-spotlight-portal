#!/bin/bash

# Safe deployment script for Supabase webhook function
# Ensures function is ALWAYS deployed without JWT verification

set -e

FUNCTION_NAME="bison-interested-webhook"
SUPABASE_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_765c83453a7d30be808b30e47cc230e0e9686015}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  Deploying Webhook Function (Safe Mode)"
echo "============================================"
echo ""

# Check if Supabase token is set
if [ -z "$SUPABASE_TOKEN" ]; then
  echo -e "${RED}✗ SUPABASE_ACCESS_TOKEN not set${NC}"
  echo "Set it with: export SUPABASE_ACCESS_TOKEN=your_token"
  exit 1
fi

echo -e "${CYAN}Function:${NC} ${FUNCTION_NAME}"
echo -e "${CYAN}JWT Verification:${NC} ${RED}DISABLED${NC} (required for Email Bison webhooks)"
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠ This will deploy the function WITHOUT JWT verification${NC}"
echo -e "${YELLOW}  This is REQUIRED for Email Bison webhooks to work${NC}"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Deployment cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${CYAN}[1/3] Deploying function...${NC}"

# Deploy with explicit --no-verify-jwt flag
SUPABASE_ACCESS_TOKEN="$SUPABASE_TOKEN" npx supabase functions deploy "$FUNCTION_NAME" --no-verify-jwt

echo ""
echo -e "${CYAN}[2/3] Testing function...${NC}"

# Test the function with a sample payload
TEST_RESPONSE=$(curl -s -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/${FUNCTION_NAME}" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "LEAD_INTERESTED",
      "workspace_name": "Deployment Test",
      "workspace_id": 999,
      "instance_url": "https://app.emailbison.com"
    },
    "data": {
      "lead": {
        "id": 99999,
        "email": "deployment-test@example.com",
        "first_name": "Deployment",
        "last_name": "Test",
        "status": "interested",
        "title": "Test",
        "company": "Test Co",
        "custom_variables": [{"name": "Phone", "value": "555-0000"}]
      },
      "reply": {
        "id": 88888,
        "uuid": "deploy-test-uuid",
        "date_received": "2025-10-06T20:00:00Z",
        "from_name": "Deployment Test",
        "from_email_address": "deployment-test@example.com"
      },
      "campaign": {
        "id": 999,
        "name": "Deployment Test"
      },
      "sender_email": {
        "id": 999,
        "email": "test@test.com",
        "name": "Test Sender"
      }
    }
  }')

# Check if test succeeded
if echo "$TEST_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  LEAD_ID=$(echo "$TEST_RESPONSE" | jq -r '.lead_id')
  echo -e "${GREEN}✓ Function test successful${NC}"
  echo -e "  Test lead ID: ${LEAD_ID}"

  # Clean up test lead
  echo ""
  echo -e "${CYAN}[3/3] Cleaning up test lead...${NC}"

  SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

  curl -s -X DELETE "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?id=eq.${LEAD_ID}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" > /dev/null

  echo -e "${GREEN}✓ Test lead cleaned up${NC}"

  echo ""
  echo "============================================"
  echo -e "${GREEN}✓ DEPLOYMENT SUCCESSFUL${NC}"
  echo "============================================"
  echo ""
  echo -e "${CYAN}Function Details:${NC}"
  echo -e "  Name: ${FUNCTION_NAME}"
  echo -e "  URL: https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/${FUNCTION_NAME}"
  echo -e "  JWT Verification: ${RED}DISABLED${NC} ✓"
  echo ""
  echo -e "${YELLOW}Next Steps:${NC}"
  echo "  1. Run webhook verification: ./scripts/verify-all-webhooks.sh"
  echo "  2. Check Supabase logs: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions"
  echo ""
else
  echo -e "${RED}✗ Function test FAILED${NC}"
  echo ""
  echo "Response:"
  echo "$TEST_RESPONSE" | jq '.'
  echo ""
  echo -e "${YELLOW}Possible issues:${NC}"
  echo "  - JWT verification may still be enabled"
  echo "  - Function code has errors"
  echo "  - Database connection issues"
  echo ""
  echo -e "${YELLOW}Troubleshooting:${NC}"
  echo "  1. Check function logs: npx supabase functions logs ${FUNCTION_NAME}"
  echo "  2. Verify deployment: check Supabase dashboard"
  echo "  3. Try redeploying: ./scripts/deploy-webhook-function.sh"
  echo ""
  exit 1
fi
