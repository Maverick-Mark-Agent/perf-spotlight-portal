#!/bin/bash

# Extract all emails from CSV
emails=$(tail -n +2 "Email Campaign Health Report - Sheet5.csv" | cut -d',' -f1 | tr -d '"' | grep '@' | paste -sd',' -)

# Query Supabase
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/sender_emails_cache?email_address=in.(${emails})&select=email_address,workspace_name,email_provider,reseller,account_type,status,bison_instance,daily_limit,emails_sent_count,total_replied_count,reply_rate_percentage" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" > email-accounts-result.json

echo "✅ Query complete. Results saved to email-accounts-result.json"
echo ""
echo "Converting to CSV..."

# Convert JSON to CSV
echo "Email Account,Bison Instance,Provider,Reseller,Account Type,Workspace,Status,Daily Limit,Total Sent,Total Replied,Reply Rate %" > email-accounts-with-all-tags.csv

jq -r '.[] | [
  .email_address,
  .bison_instance // "Unknown",
  .email_provider // "",
  .reseller // "",
  .account_type // "",
  .workspace_name // "",
  .status // "",
  .daily_limit // 0,
  .emails_sent_count // 0,
  .total_replied_count // 0,
  .reply_rate_percentage // 0
] | @csv' email-accounts-result.json >> email-accounts-with-all-tags.csv

count=$(jq '. | length' email-accounts-result.json)
maverick=$(jq '[.[] | select(.bison_instance == "Maverick")] | length' email-accounts-result.json)
longrun=$(jq '[.[] | select(.bison_instance == "Long Run")] | length' email-accounts-result.json)

echo "✅ CSV created: email-accounts-with-all-tags.csv"
echo ""
echo "📊 Summary:"
echo "  • Total found: $count accounts"
echo "  • Maverick: $maverick accounts"
echo "  • Long Run: $longrun accounts"
echo "  • Not found: $((99 - count)) accounts"
