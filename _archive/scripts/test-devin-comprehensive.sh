#!/bin/bash

API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"

# Switch to Devin Hodo
curl -s -X POST "$BASE_URL/workspaces/v1.1/switch-workspace" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"team_id": 37}' > /dev/null
sleep 1

TODAY=$(date +%Y-%m-%d)
echo "Testing for date: $TODAY"
echo ""

echo "=== Test 1: Today's workspace stats ==="
curl -s "$BASE_URL/workspaces/v1.1/stats?start_date=$TODAY&end_date=$TODAY" -H "Authorization: Bearer $API_KEY" | jq '.data | {emails_sent, total_leads_contacted}'

echo ""
echo "=== Test 2: Get campaign 92 full details ==="
curl -s "$BASE_URL/campaigns/92" -H "Authorization: Bearer $API_KEY" | jq '{id, name, status, max_emails_per_day, total_leads, emails_sent}'

echo ""
echo "=== Test 3: Check if there's a reports or analytics endpoint ==="
curl -s "$BASE_URL/reports/scheduled-emails?date=$TODAY" -H "Authorization: Bearer $API_KEY" 2>&1 | head -5

echo ""
echo "=== Test 4: Try getting lead count waiting to be sent ==="
curl -s "$BASE_URL/campaigns/92/leads?status=queued" -H "Authorization: Bearer $API_KEY" | jq '{count: (.data | length)}' 2>/dev/null || echo "No queued leads endpoint"

echo ""
echo "=== CRITICAL: What date does Email Bison's web interface show? ==="
echo "Please verify on the web page:"
echo "1. What date is selected/shown?"
echo "2. Is it actually TODAY ($TODAY) or a different date?"
echo "3. Are those 1889 emails spread across multiple days?"
echo "4. Click on one of those scheduled emails - what's its scheduled_date?"
