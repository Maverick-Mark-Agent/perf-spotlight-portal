#!/bin/bash

# Test script to check Kirk Hodgson's Airtable data
# Replace YOUR_AIRTABLE_API_KEY with your actual API key

AIRTABLE_API_KEY="YOUR_AIRTABLE_API_KEY"

echo "Fetching Kirk Hodgson's data from Airtable..."
echo ""

curl -s "https://api.airtable.com/v0/appONMVSIf5czukkf/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients?view=Positive%20Replies" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  -H "Content-Type: application/json" | \
  jq '.records[] | select(.fields["Client Company Name"] == "Kirk Hodgson") | {
    name: .fields["Client Company Name"],
    "Positive_Replies_MTD": .fields["Positive Replies MTD"],
    "Positive_Replies_Current_Month": .fields["Positive Replies Current Month"],
    "Monthly_KPI": .fields["Monthly KPI"],
    "Positive_Replies_Last_30_Days": .fields["Positive Replies Last 30 Days"],
    "Positive_Replies_Last_7_Days": .fields["Positive Replies Last 7 Days"]
  }'

echo ""
echo "---"
echo "KEY QUESTION: Which field shows 0 for October?"
echo "- If MTD = 0 and Current_Month = 9, we should use MTD"
echo "- If MTD = 9 and Current_Month = 0, we're already using the right field"
echo "- If both = 9, Airtable formulas need to be fixed"
