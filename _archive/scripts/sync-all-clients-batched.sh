#!/bin/bash

# Sync all client pipelines in batches to avoid timeout
# This syncs 5 clients at a time with delays between batches

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

# Get all active workspace names
echo "📋 Fetching active workspaces..."
WORKSPACES=$(curl -s "$SUPABASE_URL/rest/v1/client_registry?select=workspace_name&is_active=eq.true&order=workspace_name" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq -r '.[].workspace_name')

WORKSPACE_ARRAY=($WORKSPACES)
TOTAL=${#WORKSPACE_ARRAY[@]}
BATCH_SIZE=5
BATCH_NUM=1

echo "Found $TOTAL active workspaces"
echo ""

# Process in batches
for ((i=0; i<$TOTAL; i+=$BATCH_SIZE)); do
  END=$((i + $BATCH_SIZE - 1))
  if [ $END -ge $TOTAL ]; then
    END=$((TOTAL - 1))
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🚀 BATCH $BATCH_NUM: Syncing workspaces $((i+1))-$((END+1)) of $TOTAL"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Sync each workspace in this batch
  for ((j=i; j<=END && j<TOTAL; j++)); do
    WORKSPACE="${WORKSPACE_ARRAY[j]}"
    echo ""
    echo "[$((j+1))/$TOTAL] 🔄 Syncing: $WORKSPACE"

    RESULT=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sync-client-pipeline" \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"workspace_name\": \"$WORKSPACE\"}" \
      --max-time 180)

    # Check if result is valid JSON
    if echo "$RESULT" | jq -e . >/dev/null 2>&1; then
      STATUS=$(echo "$RESULT" | jq -r '.results[0].status // "unknown"')
      LEADS_SYNCED=$(echo "$RESULT" | jq -r '.results[0].leads_synced // 0')

      if [ "$STATUS" = "success" ]; then
        echo "   ✅ Success: $LEADS_SYNCED leads synced"
      else
        ERROR=$(echo "$RESULT" | jq -r '.results[0].error // "unknown error"')
        echo "   ❌ Failed: $ERROR"
      fi
    else
      echo "   ⚠️  Timeout or invalid response"
    fi

    # Small delay between workspaces
    sleep 2
  done

  BATCH_NUM=$((BATCH_NUM + 1))

  # Longer delay between batches
  if [ $END -lt $((TOTAL - 1)) ]; then
    echo ""
    echo "⏸️  Waiting 10 seconds before next batch..."
    sleep 10
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All batches complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Verifying results..."

# Get summary of leads by workspace
curl -s "$SUPABASE_URL/rest/v1/client_registry?select=workspace_name&is_active=eq.true&order=workspace_name" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq -r '.[].workspace_name' | while read ws; do

  COUNT=$(curl -s "$SUPABASE_URL/rest/v1/client_leads?select=id&workspace_name=eq.$(echo "$ws" | jq -sRr @uri)" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Range: 0-9999" \
    -H "Prefer: count=exact" | head -n 1 | grep -o 'content-range: [0-9]*-[0-9]*/[0-9]*' | grep -o '/[0-9]*' | tr -d '/')

  printf "%-30s %5s leads\n" "$ws:" "${COUNT:-0}"
done
