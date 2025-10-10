#!/bin/bash

# Using Devin Hodo's ACTUAL workspace API key from client_registry
DEVIN_API_KEY="82|rZqVRlP6Oyi9AoMLp4uGSjdc3fZsDbOAjqZQcI6hfc1675e2"
BASE_URL="https://send.maverickmarketingllc.com/api"

TODAY=$(date +%Y-%m-%d)

echo "========================================="
echo "Testing with Devin Hodo's Workspace API Key"
echo "Date: $TODAY"
echo "========================================="
echo ""

echo "=== Test 1: Check current workspace ==="
curl -s "$BASE_URL/workspaces/v1.1" -H "Authorization: Bearer $DEVIN_API_KEY" | jq '{id: .data.id, name: .data.name}'

echo ""
echo "=== Test 2: List campaigns ==="
curl -s "$BASE_URL/campaigns?status=active" -H "Authorization: Bearer $DEVIN_API_KEY" | jq '.data[] | {id, name, status, max_emails_per_day}'

echo ""
echo "=== Test 3: Sending schedules for today ==="
curl -s "$BASE_URL/campaigns/sending-schedules?day=today" -H "Authorization: Bearer $DEVIN_API_KEY" | jq '{
  count: (.data | length),
  total_scheduled: [.data[]?.emails_being_sent // 0] | add,
  campaigns: [.data[] | {campaign_id, campaign_name: .campaign.name, emails_being_sent}]
}'

echo ""
echo "=== Test 4: Workspace stats for today ==="
curl -s "$BASE_URL/workspaces/v1.1/stats?start_date=$TODAY&end_date=$TODAY" -H "Authorization: Bearer $DEVIN_API_KEY" | jq '.data | {emails_sent, total_leads_contacted}'

echo ""
echo "=== Test 5: Get scheduled emails for first active campaign ==="
CAMPAIGN_ID=$(curl -s "$BASE_URL/campaigns?status=active" -H "Authorization: Bearer $DEVIN_API_KEY" | jq -r '.data[0].id')

if [ "$CAMPAIGN_ID" != "null" ] && [ -n "$CAMPAIGN_ID" ]; then
  echo "Testing campaign ID: $CAMPAIGN_ID"
  curl -s "$BASE_URL/campaigns/$CAMPAIGN_ID/scheduled-emails" -H "Authorization: Bearer $DEVIN_API_KEY" | jq "{
    total_scheduled: (.data | length),
    scheduled_for_today: [.data[] | select(.scheduled_date | startswith(\"$TODAY\"))] | length,
    sample_dates: [.data[0:5][].scheduled_date] | unique
  }"
else
  echo "No active campaigns found"
fi
