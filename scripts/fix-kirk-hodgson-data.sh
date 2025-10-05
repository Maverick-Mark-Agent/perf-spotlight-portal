#!/bin/bash

# Fix Kirk Hodgson Data Issue
# Re-links 9 positive reply records from Kirk Hodgson to Nicholas Sakha

AIRTABLE_API_KEY="patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730"
BASE_ID="appONMVSIf5czukkf"

# Nicholas Sakha client record ID (correct destination)
NICHOLAS_SAKHA_ID="rec89jrzM22oFS5an"

echo "=========================================="
echo "Kirk Hodgson Data Fix Script"
echo "=========================================="
echo ""

# Step 1: Update Nicholas Sakha workspace name
echo "Step 1: Setting Nicholas Sakha workspace name to 'Nick Sakha'..."

curl -X PATCH "https://api.airtable.com/v0/$BASE_ID/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients/$NICHOLAS_SAKHA_ID" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "Workspace Name": "Nick Sakha"
    }
  }' | jq '.fields | {client: .["Client Company Name"], workspace: .["Workspace Name"]}'

echo "✓ Nicholas Sakha workspace name updated"
echo ""

# Step 2: Re-link 9 positive reply records
echo "Step 2: Re-linking 9 positive reply records from Kirk Hodgson to Nicholas Sakha..."

# Record IDs to update (from investigation)
RECORD_IDS=(
  "rec0Xa7lfc7S3v1lR"
  "recGKBr4yiUhfnqIx"
  "recLWu5m5xJb2UbwR"
  "recT7JKeyaHi5nEMV"
  "recYs8xvI1PGpqPxh"
  "recaie84Y2D24ssTv"
  "recc0vWrk8mgAmbwY"
  "recxWb86cMohpkHrI"
  "recyss5rTLBnnWsri"
)

# Build JSON for batch update (max 10 records per request)
JSON_RECORDS="["
for i in "${!RECORD_IDS[@]}"; do
  if [ $i -gt 0 ]; then
    JSON_RECORDS+=","
  fi
  JSON_RECORDS+="{\"id\":\"${RECORD_IDS[$i]}\",\"fields\":{\"Client\":[\"$NICHOLAS_SAKHA_ID\"]}}"
done
JSON_RECORDS+="]"

# Perform batch update
curl -X PATCH "https://api.airtable.com/v0/$BASE_ID/Positive%20Replies" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"records\":$JSON_RECORDS}" \
  | jq '.records | length as $count | "✓ Updated \($count) positive reply records"'

echo ""
echo "=========================================="
echo "Fix Complete!"
echo "=========================================="
echo ""

# Step 3: Verify the fix
echo "Step 3: Verifying fix..."
echo ""

echo "Kirk Hodgson MTD count (should be 0):"
curl -s "https://api.airtable.com/v0/$BASE_ID/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients?filterByFormula=%7BClient%20Company%20Name%7D%3D%22Kirk%20Hodgson%22" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  | jq '.records[0].fields | {"Client": .["Client Company Name"], "MTD": .["Positive Replies MTD"], "Current_Month": .["Positive Replies Current Month"]}'

echo ""
echo "Nicholas Sakha MTD count (should be 9):"
curl -s "https://api.airtable.com/v0/$BASE_ID/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients/$NICHOLAS_SAKHA_ID" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  | jq '.fields | {"Client": .["Client Company Name"], "MTD": .["Positive Replies MTD"], "Current_Month": .["Positive Replies Current Month"], "Workspace": .["Workspace Name"]}'

echo ""
echo "=========================================="
echo "Verification complete!"
echo ""
echo "Next steps:"
echo "1. Refresh your KPI Dashboard"
echo "2. Verify Kirk Hodgson shows 0 for October"
echo "3. Verify Nicholas Sakha shows 9 for October"
echo "=========================================="
