#!/bin/bash

# =============================================================================
# QA WEBHOOK VERIFICATION - Comprehensive Test Suite
# =============================================================================
#
# Tests performed:
# 1. Webhook endpoint accessibility
# 2. Webhook configuration in Email Bison (both instances)
# 3. Recent webhook deliveries (last 24 hours)
# 4. Database integrity (recent leads synced)
# 5. Payload processing validation
# 6. Error rate analysis
#
# =============================================================================

set -e

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"
WEBHOOK_ENDPOINT="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"

MAVERICK_SUPER_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
MAVERICK_BASE_URL="https://send.maverickmarketingllc.com/api"

LONGRUN_SUPER_KEY="${LONG_RUN_BISON_API_KEY:-}"
LONGRUN_BASE_URL="https://send.longrun.agency/api"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="qa-webhook-report-${TIMESTAMP}.json"

echo "=============================================="
echo "  QA WEBHOOK VERIFICATION TEST SUITE"
echo "=============================================="
echo ""
echo "Date: $(date)"
echo "Report: $REPORT_FILE"
echo ""

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Results storage
declare -a TEST_RESULTS

# Helper function to log test result
log_test() {
  local test_name="$1"
  local status="$2"
  local message="$3"
  local details="${4:-}"

  case "$status" in
    PASS)
      echo -e "${GREEN}✓ PASS${NC} - $test_name"
      ((TESTS_PASSED++))
      ;;
    FAIL)
      echo -e "${RED}✗ FAIL${NC} - $test_name"
      ((TESTS_FAILED++))
      ;;
    WARN)
      echo -e "${YELLOW}⚠ WARN${NC} - $test_name"
      ((TESTS_WARNING++))
      ;;
  esac

  if [ -n "$message" ]; then
    echo "  $message"
  fi

  if [ -n "$details" ]; then
    echo "  Details: $details"
  fi

  TEST_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"$status\",\"message\":\"$message\",\"details\":\"$details\"}")
  echo ""
}

echo "=============================================="
echo "TEST 1: Webhook Endpoint Accessibility"
echo "=============================================="
echo ""

# Test webhook endpoint is reachable
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"test":"health"}' 2>&1)

if [ "$HEALTH_RESPONSE" == "200" ] || [ "$HEALTH_RESPONSE" == "400" ]; then
  log_test "Webhook Endpoint Reachable" "PASS" "HTTP $HEALTH_RESPONSE (endpoint responding)"
else
  log_test "Webhook Endpoint Reachable" "FAIL" "HTTP $HEALTH_RESPONSE (expected 200 or 400)" "Endpoint may be down"
fi

echo "=============================================="
echo "TEST 2: Maverick Instance Webhook Config"
echo "=============================================="
echo ""

# Check Maverick instance webhook
MAVERICK_WEBHOOKS=$(curl -s "$MAVERICK_BASE_URL/webhook-url" \
  -H "Authorization: Bearer $MAVERICK_SUPER_KEY" 2>&1)

MAVERICK_WEBHOOK_COUNT=$(echo "$MAVERICK_WEBHOOKS" | jq -r '.data | length' 2>/dev/null || echo "0")
MAVERICK_INTERESTED_WEBHOOK=$(echo "$MAVERICK_WEBHOOKS" | jq -r '.data[] | select(.url == "'"$WEBHOOK_ENDPOINT"'" and .events[0] == "lead_interested") | .id' 2>/dev/null || echo "")

if [ -n "$MAVERICK_INTERESTED_WEBHOOK" ]; then
  log_test "Maverick Webhook Configured" "PASS" "Webhook ID: $MAVERICK_INTERESTED_WEBHOOK"
else
  log_test "Maverick Webhook Configured" "FAIL" "No webhook found for lead_interested event" "Found $MAVERICK_WEBHOOK_COUNT total webhooks"
fi

echo "=============================================="
echo "TEST 3: Long Run Instance Webhook Config"
echo "=============================================="
echo ""

if [ -n "$LONGRUN_SUPER_KEY" ]; then
  LONGRUN_WEBHOOKS=$(curl -s "$LONGRUN_BASE_URL/webhook-url" \
    -H "Authorization: Bearer $LONGRUN_SUPER_KEY" 2>&1)

  LONGRUN_WEBHOOK_COUNT=$(echo "$LONGRUN_WEBHOOKS" | jq -r '.data | length' 2>/dev/null || echo "0")
  LONGRUN_INTERESTED_WEBHOOK=$(echo "$LONGRUN_WEBHOOKS" | jq -r '.data[] | select(.url == "'"$WEBHOOK_ENDPOINT"'" and .events[0] == "lead_interested") | .id' 2>/dev/null || echo "")

  if [ -n "$LONGRUN_INTERESTED_WEBHOOK" ]; then
    log_test "Long Run Webhook Configured" "PASS" "Webhook ID: $LONGRUN_INTERESTED_WEBHOOK"
  else
    log_test "Long Run Webhook Configured" "FAIL" "No webhook found for lead_interested event" "Found $LONGRUN_WEBHOOK_COUNT total webhooks"
  fi
else
  log_test "Long Run Webhook Configured" "WARN" "Skipped - No Long Run API key provided"
fi

echo "=============================================="
echo "TEST 4: Recent Webhook Deliveries (Last 24h)"
echo "=============================================="
echo ""

# Check for recent leads (last 24 hours)
CUTOFF_TIME=$(date -u -v-24H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '24 hours ago' +"%Y-%m-%dT%H:%M:%SZ")
RECENT_LEADS=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=workspace_name,date_received&interested=eq.true&date_received=gte.$CUTOFF_TIME&order=date_received.desc&limit=100" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY")

RECENT_COUNT=$(echo "$RECENT_LEADS" | jq 'length' 2>/dev/null || echo "0")
WORKSPACES_WITH_ACTIVITY=$(echo "$RECENT_LEADS" | jq -r '[.[].workspace_name] | unique | length' 2>/dev/null || echo "0")

if [ "$RECENT_COUNT" -gt 0 ]; then
  log_test "Recent Webhook Deliveries" "PASS" "$RECENT_COUNT leads received from $WORKSPACES_WITH_ACTIVITY workspaces in last 24h"
else
  log_test "Recent Webhook Deliveries" "WARN" "No leads received in last 24 hours" "May indicate low activity or webhook issues"
fi

echo "=============================================="
echo "TEST 5: Database Integrity Check"
echo "=============================================="
echo ""

# Check for leads with missing required fields
LEADS_MISSING_EMAIL=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=count&lead_email=is.null&interested=eq.true" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0' 2>/dev/null || echo "0")

LEADS_MISSING_WORKSPACE=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=count&workspace_name=is.null&interested=eq.true" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0' 2>/dev/null || echo "0")

if [ "$LEADS_MISSING_EMAIL" -eq 0 ] && [ "$LEADS_MISSING_WORKSPACE" -eq 0 ]; then
  log_test "Database Integrity" "PASS" "All interested leads have required fields"
else
  log_test "Database Integrity" "WARN" "Found $LEADS_MISSING_EMAIL leads missing email, $LEADS_MISSING_WORKSPACE missing workspace"
fi

echo "=============================================="
echo "TEST 6: Payload Processing Validation"
echo "=============================================="
echo ""

# Test with valid payload
TEST_PAYLOAD='{
  "event": {
    "type": "lead_interested",
    "workspace_name": "QA Test Workspace",
    "workspace_id": 999,
    "instance_url": "https://send.maverickmarketingllc.com"
  },
  "data": {
    "lead": {
      "id": 123456,
      "email": "qa-test-'$TIMESTAMP'@verification.test",
      "first_name": "QA",
      "last_name": "Test",
      "status": "interested",
      "custom_variables": [{"name": "phone", "value": "555-TEST"}]
    },
    "reply": {
      "id": 789012,
      "uuid": "qa-test-uuid",
      "date_received": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "from_email_address": "qa-test-'$TIMESTAMP'@verification.test"
    }
  }
}'

TEST_RESPONSE=$(curl -s -X POST "$WEBHOOK_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD")

TEST_SUCCESS=$(echo "$TEST_RESPONSE" | jq -r '.success // false' 2>/dev/null)

if [ "$TEST_SUCCESS" == "true" ]; then
  TEST_LEAD_ID=$(echo "$TEST_RESPONSE" | jq -r '.lead_id // ""')
  log_test "Webhook Payload Processing" "PASS" "Test payload processed successfully" "Lead ID: $TEST_LEAD_ID"

  # Clean up test lead
  if [ -n "$TEST_LEAD_ID" ]; then
    curl -s -X DELETE "$SUPABASE_URL/rest/v1/client_leads?id=eq.$TEST_LEAD_ID" \
      -H "apikey: $SUPABASE_KEY" \
      -H "Authorization: Bearer $SUPABASE_KEY" > /dev/null
  fi
else
  ERROR_MSG=$(echo "$TEST_RESPONSE" | jq -r '.error // "Unknown error"' 2>/dev/null)
  log_test "Webhook Payload Processing" "FAIL" "Test payload failed to process" "Error: $ERROR_MSG"
fi

echo "=============================================="
echo "TEST 7: Per-Client Webhook Activity"
echo "=============================================="
echo ""

# Get list of active clients
ACTIVE_CLIENTS=$(curl -s "$SUPABASE_URL/rest/v1/client_registry?select=workspace_name,bison_instance&is_active=eq.true&order=workspace_name.asc" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY")

CLIENT_COUNT=$(echo "$ACTIVE_CLIENTS" | jq 'length' 2>/dev/null || echo "0")

# Check which clients have received leads in last 7 days
CUTOFF_7D=$(date -u -v-7d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '7 days ago' +"%Y-%m-%dT%H:%M:%SZ")
CLIENTS_WITH_LEADS=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=workspace_name&interested=eq.true&date_received=gte.$CUTOFF_7D" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq -r '[.[].workspace_name] | unique | length' 2>/dev/null || echo "0")

CLIENTS_WITHOUT_ACTIVITY=$((CLIENT_COUNT - CLIENTS_WITH_LEADS))

if [ "$CLIENTS_WITHOUT_ACTIVITY" -eq 0 ] || [ "$CLIENTS_WITHOUT_ACTIVITY" -lt 5 ]; then
  log_test "Per-Client Activity" "PASS" "$CLIENTS_WITH_LEADS/$CLIENT_COUNT clients received leads in last 7 days"
else
  log_test "Per-Client Activity" "WARN" "$CLIENTS_WITHOUT_ACTIVITY/$CLIENT_COUNT clients have no leads in last 7 days" "May indicate low activity or webhook issues"
fi

# Get detailed breakdown
echo "Client Activity Breakdown (Last 7 Days):"
curl -s "$SUPABASE_URL/rest/v1/client_leads?select=workspace_name&interested=eq.true&date_received=gte.$CUTOFF_7D" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | \
  jq -r 'group_by(.workspace_name) | map({workspace: .[0].workspace_name, count: length}) | sort_by(-.count)[] | "  \(.workspace): \(.count) leads"' 2>/dev/null || echo "  (Unable to generate breakdown)"

echo ""

echo "=============================================="
echo "TEST 8: Webhook Function Logs (Recent Errors)"
echo "=============================================="
echo ""

# Note: We can't easily check Supabase Edge Function logs via API
# But we can check for suspicious patterns in the data

# Check for leads with null conversation URLs (may indicate webhook processing errors)
LEADS_WITHOUT_URL=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=count&bison_conversation_url=is.null&interested=eq.true&date_received=gte.$CUTOFF_7D" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0' 2>/dev/null || echo "0")

if [ "$LEADS_WITHOUT_URL" -eq 0 ]; then
  log_test "Conversation URL Population" "PASS" "All recent leads have conversation URLs"
else
  log_test "Conversation URL Population" "WARN" "$LEADS_WITHOUT_URL recent leads missing conversation URLs" "May indicate webhook payload processing issue"
fi

echo "=============================================="
echo "FINAL SUMMARY"
echo "=============================================="
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_WARNING))
SUCCESS_RATE=$(echo "scale=1; $TESTS_PASSED * 100 / $TOTAL_TESTS" | bc)

echo -e "Total Tests Run:      ${CYAN}${TOTAL_TESTS}${NC}"
echo -e "Passed:               ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Failed:               ${RED}${TESTS_FAILED}${NC}"
echo -e "Warnings:             ${YELLOW}${TESTS_WARNING}${NC}"
echo -e "Success Rate:         ${BOLD}${SUCCESS_RATE}%${NC}"
echo ""

# Generate JSON report
RESULTS_ARRAY=$(IFS=,; echo "[${TEST_RESULTS[*]}]")
REPORT=$(jq -n \
  --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --argjson total "$TOTAL_TESTS" \
  --argjson passed "$TESTS_PASSED" \
  --argjson failed "$TESTS_FAILED" \
  --argjson warnings "$TESTS_WARNING" \
  --arg success_rate "$SUCCESS_RATE" \
  --argjson results "$RESULTS_ARRAY" \
  '{
    report_date: $timestamp,
    summary: {
      total_tests: $total,
      passed: $passed,
      failed: $failed,
      warnings: $warnings,
      success_rate: $success_rate
    },
    test_results: $results
  }')

echo "$REPORT" > "$REPORT_FILE"
echo "Full report saved: $REPORT_FILE"
echo ""

# Exit code
if [ "$TESTS_FAILED" -gt 0 ]; then
  echo -e "${RED}❌ VERIFICATION FAILED${NC}"
  echo "Critical issues found. Review report for details."
  exit 1
elif [ "$TESTS_WARNING" -gt 3 ]; then
  echo -e "${YELLOW}⚠️  VERIFICATION PASSED WITH WARNINGS${NC}"
  echo "Some warnings detected. Review report for details."
  exit 0
else
  echo -e "${GREEN}✅ VERIFICATION PASSED${NC}"
  echo "All critical tests passed!"
  exit 0
fi
