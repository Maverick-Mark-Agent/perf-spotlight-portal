#!/bin/bash

# Comprehensive webhook verification script
# Tests all client webhooks by sending test events and verifying delivery

SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"
WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="scripts/webhook-verification-report-${TIMESTAMP}.json"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "============================================"
echo "  Webhook Verification - All Clients"
echo "  $(date)"
echo "============================================"
echo ""

# Array to store results
RESULTS_JSON="["

# Read client registry
CLIENTS=$(jq -r '.clients[] | select(.webhook_id != null) | @json' scripts/client-registry.json)

TOTAL_CLIENTS=0
WEBHOOKS_OK=0
WEBHOOKS_WRONG_URL=0
WEBHOOKS_MISSING=0
DELIVERY_SUCCESS=0
DELIVERY_FAILED=0

while IFS= read -r client_json; do
  ((TOTAL_CLIENTS++))

  COMPANY_NAME=$(echo "$client_json" | jq -r '.company_name')
  WORKSPACE_NAME=$(echo "$client_json" | jq -r '.workspace_name')
  WORKSPACE_ID=$(echo "$client_json" | jq -r '.workspace_id')
  WEBHOOK_ID=$(echo "$client_json" | jq -r '.webhook_id')

  echo -e "${CYAN}[$TOTAL_CLIENTS] Testing: ${WORKSPACE_NAME}${NC}"
  echo "  Workspace ID: $WORKSPACE_ID"
  echo "  Expected Webhook ID: $WEBHOOK_ID"

  # Switch workspace
  curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"team_id\": ${WORKSPACE_ID}}" > /dev/null

  sleep 1

  # Check if webhook exists
  WEBHOOK_DATA=$(curl -s "${BASE_URL}/webhook-url/${WEBHOOK_ID}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  WEBHOOK_STATUS="missing"
  WEBHOOK_ACTUAL_URL=""

  if echo "$WEBHOOK_DATA" | jq -e '.data.id' > /dev/null 2>&1; then
    WEBHOOK_ACTUAL_URL=$(echo "$WEBHOOK_DATA" | jq -r '.data.url')

    if [ "$WEBHOOK_ACTUAL_URL" == "$WEBHOOK_URL" ]; then
      WEBHOOK_STATUS="ok"
      ((WEBHOOKS_OK++))
      echo -e "  ${GREEN}✓ Webhook exists with correct URL${NC}"
    else
      WEBHOOK_STATUS="wrong_url"
      ((WEBHOOKS_WRONG_URL++))
      echo -e "  ${YELLOW}⚠ Webhook exists but wrong URL${NC}"
      echo "    Expected: $WEBHOOK_URL"
      echo "    Actual:   $WEBHOOK_ACTUAL_URL"
    fi
  else
    ((WEBHOOKS_MISSING++))
    echo -e "  ${RED}✗ Webhook not found${NC}"
  fi

  # Send test webhook event
  TEST_EMAIL="webhook-test-${WORKSPACE_ID}@verify.test"
  DELIVERY_STATUS="not_tested"
  TEST_LEAD_ID=""
  ERROR_MESSAGE=""

  if [ "$WEBHOOK_STATUS" == "ok" ]; then
    echo "  Testing webhook delivery..."

    # Create test payload
    PAYLOAD=$(jq -n \
      --arg ws "$WORKSPACE_NAME" \
      --argjson wsid "$WORKSPACE_ID" \
      --arg email "$TEST_EMAIL" \
      '{
        event: {
          type: "LEAD_INTERESTED",
          workspace_name: $ws,
          workspace_id: $wsid,
          instance_url: "https://app.emailbison.com"
        },
        data: {
          lead: {
            id: 99999,
            email: $email,
            first_name: "Webhook",
            last_name: "Test",
            status: "interested",
            title: "Test Manager",
            company: "Verification Test",
            custom_variables: [{name: "Phone", value: "555-0000"}]
          },
          reply: {
            id: 88888,
            uuid: "test-verification",
            date_received: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
            from_name: "Webhook Test",
            from_email_address: $email
          },
          campaign: {
            id: 123,
            name: "Verification Test"
          },
          sender_email: {
            id: 456,
            email: "sender@test.com",
            name: $ws
          }
        }
      }')

    # Send to webhook function
    WEBHOOK_RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD")

    if echo "$WEBHOOK_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
      TEST_LEAD_ID=$(echo "$WEBHOOK_RESPONSE" | jq -r '.lead_id')

      # Verify in database
      sleep 1
      DB_CHECK=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?id=eq.${TEST_LEAD_ID}&select=id,lead_email" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}")

      if echo "$DB_CHECK" | jq -e '.[0].id' > /dev/null 2>&1; then
        DELIVERY_STATUS="success"
        ((DELIVERY_SUCCESS++))
        echo -e "  ${GREEN}✓ Webhook delivered successfully${NC}"
        echo "    Lead ID: $TEST_LEAD_ID"

        # Clean up test lead
        curl -s -X DELETE "${SUPABASE_URL}/rest/v1/client_leads?id=eq.${TEST_LEAD_ID}" \
          -H "apikey: ${SUPABASE_KEY}" \
          -H "Authorization: Bearer ${SUPABASE_KEY}" > /dev/null
      else
        DELIVERY_STATUS="db_not_found"
        ((DELIVERY_FAILED++))
        ERROR_MESSAGE="Lead created but not found in database"
        echo -e "  ${RED}✗ Lead created but not in database${NC}"
      fi
    else
      DELIVERY_STATUS="webhook_failed"
      ((DELIVERY_FAILED++))
      ERROR_MESSAGE=$(echo "$WEBHOOK_RESPONSE" | jq -r '.error // "Unknown error"')
      echo -e "  ${RED}✗ Webhook delivery failed${NC}"
      echo "    Error: $ERROR_MESSAGE"
    fi
  fi

  # Build JSON result
  RESULT=$(jq -n \
    --arg company "$COMPANY_NAME" \
    --arg workspace "$WORKSPACE_NAME" \
    --argjson wsid "$WORKSPACE_ID" \
    --argjson whid "$WEBHOOK_ID" \
    --arg wh_status "$WEBHOOK_STATUS" \
    --arg wh_url "$WEBHOOK_ACTUAL_URL" \
    --arg del_status "$DELIVERY_STATUS" \
    --arg lead_id "$TEST_LEAD_ID" \
    --arg error "$ERROR_MESSAGE" \
    '{
      company_name: $company,
      workspace_name: $workspace,
      workspace_id: $wsid,
      webhook_id: $whid,
      webhook_status: $wh_status,
      webhook_url: $wh_url,
      delivery_status: $del_status,
      test_lead_id: $lead_id,
      error: $error
    }')

  if [ "$TOTAL_CLIENTS" -gt 1 ]; then
    RESULTS_JSON="${RESULTS_JSON},"
  fi
  RESULTS_JSON="${RESULTS_JSON}${RESULT}"

  echo ""
  sleep 1
done <<< "$CLIENTS"

# Close results array
RESULTS_JSON="${RESULTS_JSON}]"

# Create summary
SUMMARY=$(jq -n \
  --argjson total "$TOTAL_CLIENTS" \
  --argjson wh_ok "$WEBHOOKS_OK" \
  --argjson wh_wrong "$WEBHOOKS_WRONG_URL" \
  --argjson wh_miss "$WEBHOOKS_MISSING" \
  --argjson del_ok "$DELIVERY_SUCCESS" \
  --argjson del_fail "$DELIVERY_FAILED" \
  '{
    verification_date: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    total_clients: $total,
    webhooks_ok: $wh_ok,
    webhooks_wrong_url: $wh_wrong,
    webhooks_missing: $wh_miss,
    delivery_success: $del_ok,
    delivery_failed: $del_fail
  }')

# Write report
FULL_REPORT=$(jq -n \
  --argjson summary "$SUMMARY" \
  --argjson clients "$RESULTS_JSON" \
  '{
    summary: $summary,
    clients: $clients
  }')

echo "$FULL_REPORT" > "$REPORT_FILE"

# Print summary
echo "============================================"
echo "  SUMMARY"
echo "============================================"
echo -e "Total Clients:        ${CYAN}${TOTAL_CLIENTS}${NC}"
echo -e "Webhooks OK:          ${GREEN}${WEBHOOKS_OK}${NC}"
echo -e "Webhooks Wrong URL:   ${YELLOW}${WEBHOOKS_WRONG_URL}${NC}"
echo -e "Webhooks Missing:     ${RED}${WEBHOOKS_MISSING}${NC}"
echo -e "Delivery Success:     ${GREEN}${DELIVERY_SUCCESS}${NC}"
echo -e "Delivery Failed:      ${RED}${DELIVERY_FAILED}${NC}"
echo ""
echo "Report saved: $REPORT_FILE"
echo ""

if [ $DELIVERY_FAILED -gt 0 ]; then
  echo -e "${YELLOW}⚠ Some webhooks failed delivery test${NC}"
  echo "Review report for details"
  exit 1
elif [ $WEBHOOKS_WRONG_URL -gt 0 ] || [ $WEBHOOKS_MISSING -gt 0 ]; then
  echo -e "${YELLOW}⚠ Some webhooks have configuration issues${NC}"
  echo "Review report for details"
  exit 1
else
  echo -e "${GREEN}✓ All webhooks verified successfully!${NC}"
  exit 0
fi
