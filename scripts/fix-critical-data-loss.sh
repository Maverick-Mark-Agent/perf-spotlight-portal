#!/bin/bash

# Fix Critical Data Loss - Phase 2
# SMA Insurance: Re-link 7 records from Workspark
# Devin Hodo: Link 3 records to client

AIRTABLE_API_KEY="patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730"
BASE_ID="appONMVSIf5czukkf"
POSITIVE_REPLIES_TABLE="Positive Replies"

echo "=========================================="
echo "Fix Critical Data Loss - Phase 2"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Client record IDs
SMA_INSURANCE_CLIENT_ID="recA7H79CtY4NmXc0"
DEVIN_HODO_CLIENT_ID="rec56lDQk9dy6aJYz"

echo "Step 1: Re-linking 7 SMA Insurance records from Workspark..."
echo ""

# SMA Insurance positive reply record IDs (currently linked to Workspark)
SMA_RECORDS=(
  "rec2nYDwubpEitTGs"
  "rec9SLe7fnuDbEkg4"
  "recC0gO4gXP3v2vNw"
  "recPTM5UBj3ZnwYAs"
  "recYpU4Z4FK7MzAoT"
  "recgFREIjV1uCThFC"
  "recwRpPa4Nvh0034U"
)

for RECORD_ID in "${SMA_RECORDS[@]}"; do
  echo "  Re-linking record $RECORD_ID to SMA Insurance Services..."

  RESPONSE=$(curl -s -X PATCH "https://api.airtable.com/v0/$BASE_ID/Positive%20Replies/$RECORD_ID" \
    -H "Authorization: Bearer $AIRTABLE_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"fields\": {\"Client\": [\"$SMA_INSURANCE_CLIENT_ID\"]}}")

  if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    echo "  ✓ Record $RECORD_ID re-linked successfully"
  else
    echo "  ✗ Failed to re-link record $RECORD_ID"
    echo "    Error: $(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')"
  fi
done

echo ""
echo "Step 2: Linking 3 Devin Hodo records to client..."
echo ""

# Devin Hodo positive reply record IDs (currently have null Client field)
DEVIN_RECORDS=(
  "rec4ZZjXRGa7aSGI9"
  "recBjDVznu7Q0kYoJ"
  "recnh6RFYafPNhi3v"
)

for RECORD_ID in "${DEVIN_RECORDS[@]}"; do
  echo "  Linking record $RECORD_ID to Devin Hodo..."

  RESPONSE=$(curl -s -X PATCH "https://api.airtable.com/v0/$BASE_ID/Positive%20Replies/$RECORD_ID" \
    -H "Authorization: Bearer $AIRTABLE_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"fields\": {\"Client\": [\"$DEVIN_HODO_CLIENT_ID\"]}}")

  if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    echo "  ✓ Record $RECORD_ID linked successfully"
  else
    echo "  ✗ Failed to link record $RECORD_ID"
    echo "    Error: $(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')"
  fi
done

echo ""
echo "=========================================="
echo "Waiting 5 seconds for Airtable to update count fields..."
echo "=========================================="
sleep 5

echo ""
echo "Step 3: Verifying fixes..."
echo ""

# Get SMA Insurance MTD count
SMA_DATA=$(curl -s "https://api.airtable.com/v0/$BASE_ID/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients/$SMA_INSURANCE_CLIENT_ID" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY")

SMA_MTD=$(echo "$SMA_DATA" | jq -r '.fields["Positive Replies MTD"] // 0')
echo "SMA Insurance MTD count (should be 7): $SMA_MTD"

# Get Devin Hodo MTD count
DEVIN_DATA=$(curl -s "https://api.airtable.com/v0/$BASE_ID/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients/$DEVIN_HODO_CLIENT_ID" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY")

DEVIN_MTD=$(echo "$DEVIN_DATA" | jq -r '.fields["Positive Replies MTD"] // 0')
echo "Devin Hodo MTD count (should be 3): $DEVIN_MTD"

# Get Workspark MTD count (should be 0 after re-linking)
WORKSPARK_ID="recvsOKIUugkN3CDC"
WORKSPARK_DATA=$(curl -s "https://api.airtable.com/v0/$BASE_ID/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients/$WORKSPARK_ID" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY")

WORKSPARK_MTD=$(echo "$WORKSPARK_DATA" | jq -r '.fields["Positive Replies MTD"] // 0')
echo "Workspark MTD count (should be 0): $WORKSPARK_MTD"

echo ""
echo "=========================================="
echo "Fix Complete!"
echo "=========================================="
echo ""

# Validation
if [ "$SMA_MTD" -eq 7 ] && [ "$DEVIN_MTD" -eq 3 ] && [ "$WORKSPARK_MTD" -eq 0 ]; then
  echo "✅ All fixes verified successfully!"
  echo ""
  echo "Summary:"
  echo "- SMA Insurance: 0 → 7 positive replies ✅"
  echo "- Devin Hodo: 0 → 3 positive replies ✅"
  echo "- Workspark: 7 → 0 positive replies ✅"
else
  echo "⚠️ Verification failed. Manual review needed."
  echo ""
  echo "Results:"
  echo "- SMA Insurance: $SMA_MTD (expected 7)"
  echo "- Devin Hodo: $DEVIN_MTD (expected 3)"
  echo "- Workspark: $WORKSPARK_MTD (expected 0)"
fi

echo ""
