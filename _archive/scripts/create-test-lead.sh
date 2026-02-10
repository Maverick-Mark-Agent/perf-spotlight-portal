#!/bin/bash

# Create a test lead for David Amiri to verify pipeline display

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

echo "Creating test lead for David Amiri..."
echo ""

RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads" \
  -X POST \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "workspace_name": "David Amiri",
    "first_name": "Test",
    "last_name": "Webhook Lead",
    "lead_email": "test-webhook-demo@example.com",
    "phone": "555-123-4567",
    "title": "CEO",
    "company": "Test Company Inc.",
    "pipeline_stage": "new",
    "lead_value": 0,
    "bison_conversation_url": "https://dedi.emailbison.com/workspaces/25/leads/999",
    "custom_variables": [
      {"name": "source", "value": "manual-test"},
      {"name": "test_lead", "value": "true"}
    ]
  }')

echo "$RESPONSE" | python3 -m json.tool

echo ""
echo "✅ Test lead created!"
echo ""
echo "Check the pipeline at: http://localhost:8082/client-portal/David%20Amiri"
echo "Look for: Test Webhook Lead (test-webhook-demo@example.com)"
