#!/bin/bash

# Test script to send a test interested lead webhook for Tony Schmitz
# This will trigger a Slack notification to your test channel

echo "Sending test interested lead webhook for Tony Schmitz..."

curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook" \
  -H "Content-Type: application/json" \
  -d '{
  "event": {
    "type": "lead_interested",
    "workspace_name": "Tony Schmitz",
    "workspace_id": 41,
    "instance_url": "https://send.maverickmarketingllc.com"
  },
  "data": {
    "lead": {
      "id": 12345,
      "email": "brett.m.winston@gmail.com",
      "first_name": "Brett",
      "last_name": "Winston",
      "company": "Test Insurance Co",
      "title": "Agent",
      "custom_variables": [
        {"name": "birthday", "value": "9/25/1982"},
        {"name": "address", "value": "144 Camelin Dr"},
        {"name": "city", "value": "Washington"},
        {"name": "state", "value": "IL"},
        {"name": "zip", "value": "61571"},
        {"name": "renewal_date", "value": "October 31st"},
        {"name": "phone", "value": "(309) 657-1339"}
      ]
    },
    "reply": {
      "uuid": "test-reply-uuid-12345",
      "date_received": "2025-10-13T12:54:00Z",
      "body_plain": "Happy to have a second opinion / review. Let me know what you need from me to kick this off.",
      "text_body": "Happy to have a second opinion / review. Let me know what you need from me to kick this off."
    }
  }
}'

echo ""
echo "Test webhook sent! Check your Slack channel for the notification."
