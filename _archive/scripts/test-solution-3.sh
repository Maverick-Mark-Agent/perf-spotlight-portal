#!/bin/bash

API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"

echo "=== Switching to Devin Hodo workspace (ID 37) ==="
curl -s -X POST "$BASE_URL/workspaces/v1.1/switch-workspace" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"team_id": 37}' > /dev/null
sleep 0.5

echo ""
echo "========================================="
echo "SOLUTION 3: Get scheduled emails per campaign"
echo "========================================="
echo ""

# Get today's date in YYYY-MM-DD format
TODAY=$(date +%Y-%m-%d)
echo "Today's date: $TODAY"
echo ""

# Campaign IDs from previous test
CAMPAIGNS=(15 16)

TOTAL_SCHEDULED=0

for campaign_id in "${CAMPAIGNS[@]}"; do
  echo "-----------------------------------"
  echo "Campaign ID: $campaign_id"
  echo "-----------------------------------"

  # Get all scheduled emails for this campaign
  RESPONSE=$(curl -s "$BASE_URL/campaigns/$campaign_id/scheduled-emails" -H "Authorization: Bearer $API_KEY")

  # Count total scheduled emails
  TOTAL_EMAILS=$(echo "$RESPONSE" | jq '.data | length')
  echo "Total scheduled emails (all dates): $TOTAL_EMAILS"

  # Count emails scheduled for today
  TODAY_EMAILS=$(echo "$RESPONSE" | jq "[.data[] | select(.scheduled_date | startswith(\"$TODAY\"))] | length")
  echo "Emails scheduled for today ($TODAY): $TODAY_EMAILS"

  TOTAL_SCHEDULED=$((TOTAL_SCHEDULED + TODAY_EMAILS))

  # Show sample scheduled dates
  echo "Sample scheduled dates:"
  echo "$RESPONSE" | jq -r '[.data[0:5][].scheduled_date] | unique | .[]' | head -5

  echo ""
done

echo "========================================="
echo "FINAL RESULT"
echo "========================================="
echo "Total emails scheduled for TODAY across all campaigns: $TOTAL_SCHEDULED"
echo "Expected: 1889"
echo ""

if [ "$TOTAL_SCHEDULED" == "1889" ]; then
  echo "✅ SUCCESS! Matches expected value."
else
  echo "⚠️  Got $TOTAL_SCHEDULED (difference: $((1889 - TOTAL_SCHEDULED)))"
fi
