#!/bin/bash

# Test script to verify Devin Hodo's scheduled emails for today
# Expected result: 1889 emails

MAVERICK_API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
MAVERICK_BASE_URL="https://send.maverickmarketingllc.com/api"
WORKSPACE_ID=37
WORKSPACE_NAME="Devin Hodo"

echo "========================================="
echo "Testing Scheduled Emails for Devin Hodo"
echo "========================================="
echo ""

# Step 1: Switch to Devin Hodo's workspace
echo "Step 1: Switching to workspace '$WORKSPACE_NAME' (ID: $WORKSPACE_ID)..."
SWITCH_RESPONSE=$(curl -s -X POST "$MAVERICK_BASE_URL/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer $MAVERICK_API_KEY" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{\"team_id\": $WORKSPACE_ID}")

echo "Switch response: $SWITCH_RESPONSE"
echo ""

# Wait for workspace switch to propagate
echo "Waiting 500ms for workspace switch to propagate..."
sleep 0.5
echo ""

# Step 2: Test Solution 1 - /api/campaigns/sending-schedules
echo "========================================="
echo "SOLUTION 1: /api/campaigns/sending-schedules (GET with body)"
echo "========================================="
echo ""

# Try GET with request body (non-standard but documented)
SCHEDULE_RESPONSE=$(curl -s -X GET "$MAVERICK_BASE_URL/campaigns/sending-schedules" \
  -H "Authorization: Bearer $MAVERICK_API_KEY" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"day": "today"}')

echo "Raw response:"
echo "$SCHEDULE_RESPONSE" | jq '.'
echo ""

# Parse and sum emails_being_sent
TOTAL_SCHEDULED=$(echo "$SCHEDULE_RESPONSE" | jq '[.data[]?.emails_being_sent // 0] | add')

echo "-----------------------------------"
echo "RESULT:"
echo "Total emails scheduled for today: $TOTAL_SCHEDULED"
echo "Expected: 1889"
echo ""

if [ "$TOTAL_SCHEDULED" == "1889" ]; then
  echo "✅ SUCCESS! Count matches expected value."
else
  echo "⚠️  WARNING: Count does not match expected value."
  echo "   Got: $TOTAL_SCHEDULED"
  echo "   Expected: 1889"
fi

echo ""
echo "========================================="
echo ""

# Step 3: Test Solution 2 - Get campaigns first, then individual schedules
echo "========================================="
echo "SOLUTION 2: Individual campaign schedules"
echo "========================================="
echo ""

echo "Fetching active campaigns..."
CAMPAIGNS_RESPONSE=$(curl -s "$MAVERICK_BASE_URL/campaigns?status=active" \
  -H "Authorization: Bearer $MAVERICK_API_KEY" \
  -H "Accept: application/json")

CAMPAIGN_COUNT=$(echo "$CAMPAIGNS_RESPONSE" | jq '.data | length')
echo "Found $CAMPAIGN_COUNT active campaigns"
echo ""

# For each campaign, get its sending schedule
TOTAL_FROM_INDIVIDUAL=0

echo "Fetching individual campaign schedules..."
for campaign_id in $(echo "$CAMPAIGNS_RESPONSE" | jq -r '.data[]?.id // empty'); do
  echo "  Campaign ID $campaign_id..."

  IND_SCHEDULE=$(curl -s -X GET "$MAVERICK_BASE_URL/campaigns/$campaign_id/sending-schedule" \
    -H "Authorization: Bearer $MAVERICK_API_KEY" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -d '{"day": "today"}')

  CAMPAIGN_EMAILS=$(echo "$IND_SCHEDULE" | jq '.data.emails_being_sent // 0')
  echo "    Scheduled: $CAMPAIGN_EMAILS emails"

  TOTAL_FROM_INDIVIDUAL=$((TOTAL_FROM_INDIVIDUAL + CAMPAIGN_EMAILS))
done

echo ""
echo "-----------------------------------"
echo "RESULT:"
echo "Total from individual schedules: $TOTAL_FROM_INDIVIDUAL"
echo "Expected: 1889"
echo ""

if [ "$TOTAL_FROM_INDIVIDUAL" == "1889" ]; then
  echo "✅ SUCCESS! Count matches expected value."
else
  echo "⚠️  WARNING: Count does not match expected value."
fi

echo ""
echo "========================================="
echo "Test Complete"
echo "========================================="
