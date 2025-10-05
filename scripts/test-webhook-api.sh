#!/bin/bash

# Test webhook using Email Bison API
# This sends a test "Lead Interested" event to our Supabase webhook function

API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"

echo "================================================"
echo "Testing Webhook via Email Bison API"
echo "================================================"
echo ""
echo "Event Type: lead_interested"
echo "Webhook URL: $WEBHOOK_URL"
echo ""
echo "Sending test webhook..."
echo ""

RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-events/test-event" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "event_type": "lead_interested",
    "url": "'"${WEBHOOK_URL}"'"
  }')

echo "Response from Email Bison:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q '"success".*true'; then
  echo "✅ Email Bison successfully sent the test webhook"
  echo ""
  echo "Now checking if lead was created in database..."
  echo ""

  # Wait a moment for webhook to process
  sleep 2

  # Check recent leads
  ./scripts/check-recent-leads.sh
else
  echo "❌ Failed to send test webhook"
  echo "Check the error message above"
fi
