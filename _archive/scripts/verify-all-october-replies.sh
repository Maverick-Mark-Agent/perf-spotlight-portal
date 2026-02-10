#!/bin/bash

# Verify All October Positive Replies
# Check every client's Email Bison stats vs Airtable records

EMAIL_BISON_API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
AIRTABLE_API_KEY="patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730"
BASE_ID="appONMVSIf5czukkf"

START_DATE="2025-10-01"
END_DATE=$(date +%Y-%m-%d)

echo "=========================================="
echo "October Positive Replies Verification"
echo "Date Range: $START_DATE to $END_DATE"
echo "=========================================="
echo ""

# Fetch all workspaces
WORKSPACES=$(curl -s "https://send.maverickmarketingllc.com/api/workspaces/v1.1" \
  -H "Authorization: Bearer $EMAIL_BISON_API_KEY" \
  -H "Accept: application/json" | jq -r '.data[] | "\(.id)|\(.name)"')

echo "| Workspace | Email Bison Oct | Airtable Oct | Status |"
echo "|-----------|----------------|--------------|--------|"

TOTAL_DISCREPANCIES=0
MISSING_REPLIES=()

while IFS='|' read -r WS_ID WS_NAME; do
  # Switch to workspace
  curl -s -X POST "https://send.maverickmarketingllc.com/api/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer $EMAIL_BISON_API_KEY" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -d "{\"team_id\": $WS_ID}" > /dev/null 2>&1

  # Get Email Bison stats for October
  BISON_INTERESTED=$(curl -s "https://send.maverickmarketingllc.com/api/workspaces/v1.1/stats?start_date=$START_DATE&end_date=$END_DATE" \
    -H "Authorization: Bearer $EMAIL_BISON_API_KEY" \
    -H "Accept: application/json" | jq -r '.data.interested // 0')

  # Get Airtable count for October
  AIRTABLE_COUNT=$(curl -s "https://api.airtable.com/v0/$BASE_ID/Positive%20Replies?filterByFormula=AND(SEARCH(\"$WS_NAME\",{Workspace%20Name}),IS_AFTER({Date%20Received},\"2025-09-30\"))" \
    -H "Authorization: Bearer $AIRTABLE_API_KEY" | jq -r '.records | length')

  # Compare
  if [ "$BISON_INTERESTED" -gt 0 ] || [ "$AIRTABLE_COUNT" -gt 0 ]; then
    if [ "$BISON_INTERESTED" -ne "$AIRTABLE_COUNT" ]; then
      STATUS="❌ MISMATCH"
      TOTAL_DISCREPANCIES=$((TOTAL_DISCREPANCIES + 1))
      MISSING_REPLIES+=("$WS_NAME|$BISON_INTERESTED|$AIRTABLE_COUNT")
      echo "| $WS_NAME | $BISON_INTERESTED | $AIRTABLE_COUNT | $STATUS |"
    else
      STATUS="✅ Match"
      echo "| $WS_NAME | $BISON_INTERESTED | $AIRTABLE_COUNT | $STATUS |"
    fi
  fi

done <<< "$WORKSPACES"

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Total discrepancies found: $TOTAL_DISCREPANCIES"
echo ""

if [ $TOTAL_DISCREPANCIES -gt 0 ]; then
  echo "Clients with missing replies:"
  for ITEM in "${MISSING_REPLIES[@]}"; do
    IFS='|' read -r NAME BISON AIRTABLE <<< "$ITEM"
    DIFF=$((BISON - AIRTABLE))
    echo "  - $NAME: Missing $DIFF replies (Bison=$BISON, Airtable=$AIRTABLE)"
  done
fi

echo ""
