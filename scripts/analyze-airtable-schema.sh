#!/bin/bash

# Airtable Schema Analysis Script
# This script fetches complete schema information from Airtable base appONMVSIf5czukkf

AIRTABLE_API_KEY="patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730"
BASE_ID="appONMVSIf5czukkf"
OUTPUT_DIR="./docs/airtable-analysis"

mkdir -p "$OUTPUT_DIR"

echo "=========================================="
echo "Airtable Schema Analysis"
echo "Base: $BASE_ID"
echo "=========================================="
echo ""

# Fetch all tables schema
echo "Fetching table schemas..."
curl -s "https://api.airtable.com/v0/meta/bases/$BASE_ID/tables" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  > "$OUTPUT_DIR/tables-schema.json"

echo "✓ Saved table schemas to $OUTPUT_DIR/tables-schema.json"
echo ""

# Extract table names and IDs
echo "Tables in base:"
jq -r '.tables[] | "\(.id) - \(.name)"' "$OUTPUT_DIR/tables-schema.json"
echo ""

# Key tables to analyze in detail
TABLES=(
  "👨‍💻 Clients"
  "📨 Positive Replies"
  "📧 Email Accounts"
  "📊 Campaigns Performance"
  "🌐 Domains"
)

echo "Fetching sample data from key tables..."
echo ""

for TABLE in "${TABLES[@]}"; do
  ENCODED_TABLE=$(echo "$TABLE" | jq -sRr @uri)
  SAFE_NAME=$(echo "$TABLE" | sed 's/[^a-zA-Z0-9]/-/g')

  echo "Analyzing: $TABLE"

  # Fetch schema details
  jq --arg table "$TABLE" '.tables[] | select(.name == $table)' "$OUTPUT_DIR/tables-schema.json" \
    > "$OUTPUT_DIR/schema-$SAFE_NAME.json"

  # Fetch sample records (first 3)
  curl -s "https://api.airtable.com/v0/$BASE_ID/$ENCODED_TABLE?maxRecords=3" \
    -H "Authorization: Bearer $AIRTABLE_API_KEY" \
    > "$OUTPUT_DIR/sample-$SAFE_NAME.json"

  # Count total records
  RECORD_COUNT=$(curl -s "https://api.airtable.com/v0/$BASE_ID/$ENCODED_TABLE?maxRecords=1" \
    -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq -r '.records | length')

  echo "  Fields: $(jq '.fields | length' "$OUTPUT_DIR/schema-$SAFE_NAME.json")"
  echo "  Sample records saved"
  echo ""
done

echo "=========================================="
echo "Analysis complete!"
echo "Results saved to: $OUTPUT_DIR"
echo "=========================================="
