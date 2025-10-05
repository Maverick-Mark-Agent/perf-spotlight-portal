#!/bin/bash

# Sync David Amiri interested leads by fetching ALL leads and filtering locally for interested=true

API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BISON_BASE_URL='https://send.maverickmarketingllc.com/api'
SUPABASE_URL='https://gjqbbgrfhijescaouqkx.supabase.co'
SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
WORKSPACE_ID=25
WORKSPACE_NAME='David Amiri'

echo "=== Syncing David Amiri Interested Leads ==="
echo ""

# Step 1: Delete existing David Amiri leads
echo "Step 1: Deleting existing David Amiri leads..."
curl -s -X DELETE "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Prefer: return=minimal" > /dev/null
echo "✓ Deleted existing leads"
echo ""

# Step 2: Fetch ALL leads for workspace 25 and filter locally
echo "Step 2: Fetching all leads from Email Bison (7,415 leads)..."
echo "This will take a few minutes..."

TOTAL=7415
PER_PAGE=100
PAGES=$(( (TOTAL + PER_PAGE - 1) / PER_PAGE ))

echo "Fetching ${PAGES} pages..."
echo ""

INTERESTED_COUNT=0
TEMP_FILE=$(mktemp)

# Fetch all pages
for page in $(seq 1 $PAGES); do
  echo "Fetching page ${page}/${PAGES}..."

  # Fetch page
  LEADS_JSON=$(curl -s "${BISON_BASE_URL}/leads?workspace_id=${WORKSPACE_ID}&page=${page}&per_page=${PER_PAGE}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Accept: application/json")

  # Filter for interested leads and transform
  echo "$LEADS_JSON" | jq -c '.data[] | select(.lead_campaign_data != null and .lead_campaign_data != [] and ([.lead_campaign_data[] | .interested] | any)) | {
    bison_reply_id: ("lead_" + (.id | tostring)),
    bison_lead_id: (.id | tostring),
    workspace_name: "'"$WORKSPACE_NAME"'",
    lead_email: .email,
    first_name: .first_name,
    last_name: .last_name,
    phone: .phone,
    address: .address,
    city: .city,
    state: .state,
    zip: .zip,
    title: .title,
    company: .company,
    custom_variables: (.custom_variables // []),
    tags: (.tags // []),
    lead_status: .status,
    lead_campaign_data: (.lead_campaign_data // []),
    overall_stats: .overall_stats,
    date_received: null,
    reply_received: null,
    email_subject: null,
    lead_value: 500,
    renewal_date: null,
    birthday: null,
    bison_conversation_url: ("https://send.maverickmarketingllc.com/leads/" + (.id | tostring)),
    pipeline_stage: "new",
    pipeline_position: 0,
    last_synced_at: (now | todate)
  }' >> "$TEMP_FILE"

  # Count interested leads found so far
  COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')
  if [ "$COUNT" != "$INTERESTED_COUNT" ]; then
    NEW_FOUND=$(( COUNT - INTERESTED_COUNT ))
    echo "  → Found ${NEW_FOUND} interested leads on this page (total: ${COUNT})"
    INTERESTED_COUNT=$COUNT
  fi
done

echo ""
echo "=== Found ${INTERESTED_COUNT} Interested Leads ==="
echo ""

# Step 3: Insert leads into Supabase
if [ "$INTERESTED_COUNT" -gt 0 ]; then
  echo "Step 3: Inserting leads into Supabase..."

  cat "$TEMP_FILE" | while read -r lead; do
    curl -s -X POST "${SUPABASE_URL}/rest/v1/client_leads" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "$lead" > /dev/null 2>&1
  done

  echo "✓ Inserted ${INTERESTED_COUNT} leads"
else
  echo "⚠️  No interested leads found"
fi

# Cleanup
rm "$TEMP_FILE"

echo ""
echo "=== Sync Complete ==="
echo ""

# Step 4: Verify count
echo "Verifying..."
COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri&select=id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq '. | length')

echo "✓ Total leads in database: ${COUNT}"
echo ""
echo "All done! Check http://localhost:8082/client-portal/David%20Amiri"
