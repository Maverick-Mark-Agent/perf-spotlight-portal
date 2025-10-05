#!/bin/bash
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"
BASE_URL="https://send.maverickmarketingllc.com"

echo "============================================"
echo "  Updating URLs to Inbox Search Pattern"
echo "============================================"
echo ""

# Get all Devin Hodo leads with email addresses
echo "Fetching Devin Hodo leads..."
LEADS=$(curl -s -G "${SUPABASE_URL}/rest/v1/client_leads" \
  --data-urlencode "workspace_name=eq.Devin Hodo" \
  --data-urlencode "select=id,lead_email" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

LEAD_COUNT=$(echo "$LEADS" | jq '. | length')
echo "Found ${LEAD_COUNT} leads"
echo ""

# Update each lead's conversation URL
UPDATED=0
ERRORS=0

echo "$LEADS" | jq -c '.[]' | while read -r LEAD; do
  ID=$(echo "$LEAD" | jq -r '.id')
  EMAIL=$(echo "$LEAD" | jq -r '.lead_email')

  # Generate inbox search URL
  SEARCH_URL="${BASE_URL}/inbox?search=${EMAIL}"

  # Update the lead
  PAYLOAD=$(jq -n --arg url "$SEARCH_URL" '{bison_conversation_url: $url}')

  RESPONSE=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/client_leads?id=eq.${ID}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$PAYLOAD")

  ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message // empty' 2>/dev/null)

  if [ -n "$ERROR_MSG" ]; then
    echo "  ❌ Error: ${EMAIL}"
    ((ERRORS++))
  else
    echo "  ✅ ${EMAIL}"
    ((UPDATED++))
  fi
done

echo ""
echo "============================================"
echo "Complete!"
echo "  Updated: ${UPDATED}"
echo "  Errors: ${ERRORS}"
echo "============================================"
echo ""
echo "New URL format: ${BASE_URL}/inbox?search={lead_email}"
