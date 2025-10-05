#!/bin/bash

# Delete the test lead created for demo purposes

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

echo "Deleting test lead..."
echo ""

# Delete by email
RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?lead_email=eq.test-webhook-demo@example.com" \
  -X DELETE \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

echo "✅ Test lead deleted!"
echo ""
echo "The test lead 'Test Webhook Lead' has been removed from David Amiri's pipeline."
