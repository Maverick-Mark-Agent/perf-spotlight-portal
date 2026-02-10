#!/bin/bash

# Setup webhook for David Amiri workspace to automatically add interested leads to pipeline
# This webhook will trigger when a contact is tagged as "Interested" in Email Bison

API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"
WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"

echo "================================================"
echo "Setting up webhook for David Amiri workspace"
echo "================================================"
echo ""

# Create the webhook
echo "Creating webhook..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-url" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "name": "Client Portal Pipeline - Interested Leads",
    "url": "'"${WEBHOOK_URL}"'",
    "events": ["lead_interested"]
  }')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if webhook was created successfully
if echo "$RESPONSE" | grep -q '"id"'; then
  WEBHOOK_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
  echo "✅ Success! Webhook created with ID: $WEBHOOK_ID"
  echo ""
  echo "Webhook Details:"
  echo "  - Name: Client Portal Pipeline - Interested Leads"
  echo "  - URL: $WEBHOOK_URL"
  echo "  - Events: lead_interested (Contact Interested)"
  echo ""
  echo "Next Steps:"
  echo "  1. Tag a lead as 'Interested' in Email Bison"
  echo "  2. Check the client portal pipeline at http://localhost:8082/client-portal/David%20Amiri"
  echo "  3. The lead should appear in the 'New Lead' stage"
else
  echo "❌ Failed to create webhook"
  echo "Please check the error message above"
  exit 1
fi
