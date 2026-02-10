#!/bin/bash

# Sync all 24 clients' interested leads from Email Bison
# This ensures 100% billing accuracy

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

CLIENTS=(
  "Danny Schwartz"
  "David Amiri"
  "Devin Hodo"
  "Gregg Blanchard"
  "Jason Binyon"
  "Jeff Schroder"
  "John Roberts"
  "Kirk Hodgson"
  "Maverick In-house"
  "Nick Sakha"
  "Rob Russell"
  "Shane Miller"
  "SMA Insurance"
  "StreetSmart Commercial"
  "Tony Schmitz"
)

echo "=== Starting bulk sync for 15 Maverick clients ==="

for client in "${CLIENTS[@]}"; do
  echo ""
  echo "Syncing: $client..."

  curl -s "$SUPABASE_URL/functions/v1/sync-interested-replies" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_name\": \"$client\"}" | jq '{workspace: .workspace, stats: .stats}'

  echo "Waiting 3 seconds before next sync..."
  sleep 3
done

echo ""
echo "=== Sync complete! ==="
echo ""
echo "Verifying October lead counts..."

for client in "${CLIENTS[@]}"; do
  COUNT=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=count&workspace_name=eq.$client&interested=eq.true&date_received=gte.2025-10-01&date_received=lte.2025-10-08" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Prefer: count=exact" | jq '.[0].count')

  echo "$client: $COUNT leads"
done
