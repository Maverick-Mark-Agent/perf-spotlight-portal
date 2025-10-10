#!/bin/bash

# Setup Workspace API Keys - Complete Process
# This script:
# 1. Adds bison_api_key column to client_registry
# 2. Generates workspace-specific API keys for all clients
# 3. Stores them in the database

set -e

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

echo "🚀 Setting up workspace-specific API keys"
echo ""

# Step 1: Check if column exists
echo "Step 1: Checking if bison_api_key column exists..."
COLUMN_CHECK=$(curl -s "$SUPABASE_URL/rest/v1/client_registry?select=bison_api_key&limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" 2>&1)

if echo "$COLUMN_CHECK" | grep -q "column"; then
  echo "❌ Column does not exist!"
  echo ""
  echo "📋 Please run this SQL in Supabase Dashboard (SQL Editor):"
  echo ""
  echo "ALTER TABLE client_registry ADD COLUMN bison_api_key TEXT;"
  echo ""
  echo "Then run this script again."
  exit 1
else
  echo "✅ Column exists"
fi

# Step 2: Generate API keys
echo ""
echo "Step 2: Generating workspace-specific API keys..."
echo ""

curl -X POST "$SUPABASE_URL/functions/v1/generate-workspace-api-keys" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "✅ Setup complete!"
