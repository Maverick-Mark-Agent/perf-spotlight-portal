#!/bin/bash

# Fetch Long Run Bison accounts using curl
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA"

# Read emails from CSV (skip header, get first column)
emails=$(tail -n +2 "Email Campaign Health Report - Sheet5.csv" | cut -d',' -f1 | tr -d '"' | grep '@' | paste -sd',' -)

echo "🔍 Fetching accounts from database..."
echo ""

# Query all matching emails
result=$(curl -s "${SUPABASE_URL}/rest/v1/sender_emails_cache?email_address=in.(${emails})&select=email_address,workspace_name,email_provider,reseller,account_type,status,bison_instance,daily_limit,emails_sent_count,total_replied_count,reply_rate_percentage&limit=1000" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}")

# Save to file
echo "$result" > email-accounts-raw.json

# Count results
count=$(echo "$result" | jq '. | length' 2>/dev/null)

if [ "$count" -gt 0 ]; then
  echo "✅ Found $count matching accounts"
  echo ""

  # Convert to CSV
  echo "Email Account,Bison Instance,Provider,Reseller,Account Type,Workspace,Status,Daily Limit,Total Sent,Total Replied,Reply Rate %" > email-accounts-from-database.csv

  echo "$result" | jq -r '.[] | [
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
  ] | @csv' >> email-accounts-from-database.csv

  echo "💾 Saved to: email-accounts-from-database.csv"
  echo ""

  # Show breakdown by instance
  maverick=$(echo "$result" | jq '[.[] | select(.bison_instance == "Maverick")] | length')
  longrun=$(echo "$result" | jq '[.[] | select(.bison_instance == "Long Run")] | length')

  echo "📊 By Bison Instance:"
  echo "  • Maverick: $maverick accounts"
  echo "  • Long Run: $longrun accounts"

else
  echo "⚠️  No matching accounts found"
  echo "Response: $result"
fi
