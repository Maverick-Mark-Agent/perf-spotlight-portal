#!/bin/bash

echo "🚀 Deploying email sync cron setup function..."
echo ""

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN not set"
  echo ""
  echo "Please set it by running:"
  echo "export SUPABASE_ACCESS_TOKEN=your_token_here"
  echo ""
  echo "Get your token from: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

# Deploy the function
echo "📦 Deploying setup-email-sync-cron function..."
supabase functions deploy setup-email-sync-cron --no-verify-jwt

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Function deployed successfully!"
  echo ""
  echo "🔧 Now calling the function to set up the cron job..."
  echo ""

  # Call the function
  curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/setup-email-sync-cron" \
    -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
    -H "Content-Type: application/json" \
    -d '{}'

  echo ""
  echo ""
  echo "✅ Done!"
else
  echo ""
  echo "❌ Deployment failed"
  exit 1
fi
