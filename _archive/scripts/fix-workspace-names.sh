#!/bin/bash

# Fix Workspace Names - Phase 3
# Standardize workspace names to match Email Bison exactly

AIRTABLE_API_KEY="patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730"
BASE_ID="appONMVSIf5czukkf"
CLIENTS_TABLE="%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients"

echo "=========================================="
echo "Fix Workspace Names - Phase 3"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Function to update workspace name
update_workspace_name() {
  local CLIENT_ID=$1
  local CLIENT_NAME=$2
  local NEW_WORKSPACE_NAME=$3

  echo "Updating $CLIENT_NAME → Workspace Name: '$NEW_WORKSPACE_NAME'"

  RESPONSE=$(curl -s -X PATCH "https://api.airtable.com/v0/$BASE_ID/$CLIENTS_TABLE/$CLIENT_ID" \
    -H "Authorization: Bearer $AIRTABLE_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"fields\": {\"Workspace Name\": \"$NEW_WORKSPACE_NAME\"}}")

  if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    echo "  ✓ Updated successfully"
    return 0
  else
    echo "  ✗ Failed to update"
    echo "    Error: $(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')"
    return 1
  fi
}

echo "Step 1: Fixing incorrect workspace names..."
echo ""

# Get client record IDs first
echo "Fetching client records..."

# Binyon Agency
BINYON_ID=$(curl -s "https://api.airtable.com/v0/$BASE_ID/$CLIENTS_TABLE?filterByFormula=SEARCH(%22Binyon%20Agency%22%2C%7BClient%20Company%20Name%7D)" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq -r '.records[0].id')

# Biz Power Benefits
BIZ_POWER_ID=$(curl -s "https://api.airtable.com/v0/$BASE_ID/$CLIENTS_TABLE?filterByFormula=SEARCH(%22Biz%20Power%20Benefits%22%2C%7BClient%20Company%20Name%7D)" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq -r '.records[0].id')

# Tony Schmitz
TONY_ID=$(curl -s "https://api.airtable.com/v0/$BASE_ID/$CLIENTS_TABLE?filterByFormula=SEARCH(%22Tony%20Schmitz%22%2C%7BClient%20Company%20Name%7D)" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq -r '.records[0].id')

# Gregg Blanchard
GREGG_ID=$(curl -s "https://api.airtable.com/v0/$BASE_ID/$CLIENTS_TABLE?filterByFormula=SEARCH(%22Gregg%20Blanchard%22%2C%7BClient%20Company%20Name%7D)" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq -r '.records[0].id')

# Koppa Analytics
KOPPA_ID=$(curl -s "https://api.airtable.com/v0/$BASE_ID/$CLIENTS_TABLE?filterByFormula=SEARCH(%22Koppa%20Analytics%22%2C%7BClient%20Company%20Name%7D)" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq -r '.records[0].id')

# Boshra
BOSHRA_ID=$(curl -s "https://api.airtable.com/v0/$BASE_ID/$CLIENTS_TABLE?filterByFormula=SEARCH(%22Boshra%22%2C%7BClient%20Company%20Name%7D)" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq -r '.records[0].id')

echo ""
echo "Updating workspace names..."
echo ""

# Fix Binyon Agency: "BINYON AGENCY" → "Jason Binyon"
if [ "$BINYON_ID" != "null" ] && [ -n "$BINYON_ID" ]; then
  update_workspace_name "$BINYON_ID" "Binyon Agency" "Jason Binyon"
else
  echo "⚠️ Could not find Binyon Agency client"
fi

echo ""

# Fix Biz Power Benefits: "biz power heroes" → "biz power benifits"
if [ "$BIZ_POWER_ID" != "null" ] && [ -n "$BIZ_POWER_ID" ]; then
  update_workspace_name "$BIZ_POWER_ID" "Biz Power Benefits" "biz power benifits"
else
  echo "⚠️ Could not find Biz Power Benefits client"
fi

echo ""
echo "Step 2: Setting missing workspace names..."
echo ""

# Set Tony Schmitz workspace name (workspace exists in Bison)
if [ "$TONY_ID" != "null" ] && [ -n "$TONY_ID" ]; then
  update_workspace_name "$TONY_ID" "Tony Schmitz" "Tony Schmitz"
else
  echo "⚠️ Could not find Tony Schmitz client"
fi

echo ""

# Set Gregg Blanchard workspace name (workspace exists in Bison)
if [ "$GREGG_ID" != "null" ] && [ -n "$GREGG_ID" ]; then
  update_workspace_name "$GREGG_ID" "Gregg Blanchard" "Gregg Blanchard"
else
  echo "⚠️ Could not find Gregg Blanchard client"
fi

echo ""

# Koppa Analytics and Boshra - need research (skip for now)
echo "⏭️  Skipping Koppa Analytics and Boshra (need to verify workspace exists)"

echo ""
echo "=========================================="
echo "Fix Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Binyon Agency: Workspace Name updated to 'Jason Binyon'"
echo "- Biz Power Benefits: Workspace Name updated to 'biz power benifits'"
echo "- Tony Schmitz: Workspace Name set to 'Tony Schmitz'"
echo "- Gregg Blanchard: Workspace Name set to 'Gregg Blanchard'"
echo ""
echo "Note: Koppa Analytics and Boshra skipped - need to verify workspaces exist"
echo ""
