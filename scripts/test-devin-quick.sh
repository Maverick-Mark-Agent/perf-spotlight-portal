#!/bin/bash

API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"

echo "=== Switching to Devin Hodo workspace (ID 37) ==="
curl -s -X POST "$BASE_URL/workspaces/v1.1/switch-workspace" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"team_id": 37}' > /dev/null
sleep 0.5

echo ""
echo "=== Test 1: List all campaigns ==="
curl -s "$BASE_URL/campaigns" -H "Authorization: Bearer $API_KEY" | jq '{count: (.data | length), campaigns: [.data[] | {id, name, status}]}'

echo ""
echo "=== Test 2: Sending schedules (no params) ==="
curl -s "$BASE_URL/campaigns/sending-schedules" -H "Authorization: Bearer $API_KEY" | jq '{count: (.data | length), total_scheduled: [.data[]?.emails_being_sent // 0] | add}'

echo ""
echo "=== Test 3: Sending schedules with ?day=today ==="
curl -s "$BASE_URL/campaigns/sending-schedules?day=today" -H "Authorization: Bearer $API_KEY" | jq '{count: (.data | length), total_scheduled: [.data[]?.emails_being_sent // 0] | add}'
