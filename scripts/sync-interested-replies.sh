#!/bin/bash

# Sync David Amiri interested leads using /api/replies with status=interested

API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BISON_BASE_URL='https://send.maverickmarketingllc.com/api'
SUPABASE_URL='https://gjqbbgrfhijescaouqkx.supabase.co'
SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
WORKSPACE_ID=25
WORKSPACE_NAME='David Amiri'

echo "=== Syncing David Amiri Interested Replies ==="
echo ""

# Step 1: Delete existing David Amiri leads
echo "Step 1: Deleting existing David Amiri leads..."
curl -s -X DELETE "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: return=minimal" > /dev/null
echo "✓ Deleted existing leads"
echo ""

# Step 2: Get total count of interested replies
echo "Step 2: Fetching interested replies from Email Bison..."
TOTAL=$(curl -s "${BISON_BASE_URL}/replies?workspace_id=${WORKSPACE_ID}&status=interested&per_page=1" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq -r '.meta.total')

echo "Found ${TOTAL} interested replies"
echo ""

# Calculate pages needed
PER_PAGE=100
PAGES=$(( (TOTAL + PER_PAGE - 1) / PER_PAGE ))
echo "Fetching ${PAGES} pages..."
echo ""

TEMP_FILE=$(mktemp)

# Step 3: Fetch all interested replies
for page in $(seq 1 $PAGES); do
  echo "Fetching page ${page}/${PAGES}..."

  # Fetch replies
  REPLIES_JSON=$(curl -s "${BISON_BASE_URL}/replies?workspace_id=${WORKSPACE_ID}&status=interested&page=${page}&per_page=${PER_PAGE}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Accept: application/json")

  # Transform to lead format
  echo "$REPLIES_JSON" | jq -c '.data[] | .lead as $lead | {
    bison_reply_id: ("reply_" + (.id | tostring)),
    bison_lead_id: ($lead.id | tostring),
    workspace_name: "'"$WORKSPACE_NAME"'",
    lead_email: $lead.email,
    first_name: $lead.first_name,
    last_name: $lead.last_name,
    phone: $lead.phone,
    address: $lead.address,
    city: $lead.city,
    state: $lead.state,
    zip: $lead.zip,
    title: $lead.title,
    company: $lead.company,
    custom_variables: ($lead.custom_variables // []),
    tags: ($lead.tags // []),
    lead_status: $lead.status,
    lead_campaign_data: ($lead.lead_campaign_data // []),
    overall_stats: $lead.overall_stats,
    date_received: .received_at,
    reply_received: .body_text,
    email_subject: .subject,
    lead_value: 500,
    renewal_date: null,
    birthday: null,
    bison_conversation_url: ("https://send.maverickmarketingllc.com/leads/" + ($lead.id | tostring)),
    pipeline_stage: "new",
    pipeline_position: 0,
    last_synced_at: (now | todate)
  }' >> "$TEMP_FILE"
done

echo ""

# Count how many we found
COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')
echo "=== Found ${COUNT} Interested Replies ==="
echo ""

# Step 4: Insert into Supabase
if [ "$COUNT" -gt 0 ]; then
  echo "Step 3: Inserting ${COUNT} leads into Supabase..."

  cat "$TEMP_FILE" | while read -r lead; do
    curl -s -X POST "${SUPABASE_URL}/rest/v1/client_leads" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "$lead" > /dev/null 2>&1
  done

  echo "✓ Inserted ${COUNT} leads"
else
  echo "⚠️  No interested replies found"
fi

# Cleanup
rm "$TEMP_FILE"

echo ""
echo "=== Sync Complete ==="
echo ""

# Step 5: Verify count
echo "Verifying..."
DB_COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri&select=id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq '. | length')

echo "✓ Total leads in database: ${DB_COUNT}"
echo ""
echo "All done! Check http://localhost:8082/client-portal/David%20Amiri"
