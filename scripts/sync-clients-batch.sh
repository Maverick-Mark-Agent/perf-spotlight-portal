#!/bin/bash

# Sync clients in small batches to avoid timeout
# Run sync-interested-replies for each client individually

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

# Array of all Maverick clients
CLIENTS=(
  "Danny Schwartz"
  "David Amiri"
  "Devin Hodo"
  "Gregg Blanchard"
  "Jason Binyon"
  "Jeff Schroder"
  "John Roberts"
  "Kim Wallace"
  "Kirk Hodgson"
  "Maverick In-house"
  "Nick Sakha"
  "Rob Russell"
  "Shane Miller"
  "SMA Insurance"
  "StreetSmart Commercial"
  "Tony Schmitz"
)

echo "===  Syncing All Maverick Clients ==="
echo "Total clients: ${#CLIENTS[@]}"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for client in "${CLIENTS[@]}"; do
  echo "----------------------------------------"
  echo "Syncing: $client"
  echo "----------------------------------------"

  RESULT=$(curl -s "$SUPABASE_URL/functions/v1/sync-interested-replies" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_name\": \"$client\"}")

  echo "$RESULT" | jq '.'

  SUCCESS=$(echo "$RESULT" | jq -r '.success')
  if [ "$SUCCESS" == "true" ]; then
    ((SUCCESS_COUNT++))
    echo "✓ Success"
  else
    ((FAIL_COUNT++))
    echo "✗ Failed"
  fi

  echo ""
  echo "Waiting 5 seconds before next client..."
  sleep 5
done

echo "========================================"
echo "Sync Complete!"
echo "Successful: $SUCCESS_COUNT"
echo "Failed: $FAIL_COUNT"
echo "========================================"
echo ""
echo "Checking October lead counts..."
echo ""

# Check October counts for all clients
for client in "${CLIENTS[@]}"; do
  COUNT=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=count&workspace_name=eq.$client&interested=eq.true&date_received=gte.2025-10-01&date_received=lte.2025-10-08" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Prefer: count=exact" | jq '.[0].count')

  printf "%-25s %s leads\n" "$client:" "$COUNT"
done
