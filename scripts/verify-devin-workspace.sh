#!/bin/bash

API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"

echo "=== Current workspace BEFORE switch ==="
curl -s "$BASE_URL/workspaces/v1.1" -H "Authorization: Bearer $API_KEY" | jq '{id: .data.id, name: .data.name}'

echo ""
echo "=== Switching to Devin Hodo (37) ==="
curl -s -X POST "$BASE_URL/workspaces/v1.1/switch-workspace" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"team_id": 37}' | jq '{id: .data.id, name: .data.name}'
sleep 0.5

echo ""
echo "=== Current workspace AFTER switch ==="
curl -s "$BASE_URL/workspaces/v1.1" -H "Authorization: Bearer $API_KEY" | jq '{id: .data.id, name: .data.name}'

echo ""
echo "=== Campaigns for this workspace ==="
curl -s "$BASE_URL/campaigns" -H "Authorization: Bearer $API_KEY" | jq '.data[] | {id, name, status, total_leads, emails_sent}'

echo ""
echo "=== Workspace stats ==="
curl -s "$BASE_URL/workspaces/v1.1/stats?start_date=2025-10-01&end_date=2025-10-09" -H "Authorization: Bearer $API_KEY" | jq '.data'
