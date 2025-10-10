#!/bin/bash

# Backfill all 24 active clients with their historical interested leads
# This script runs the single-client backfill for each workspace sequentially

echo "🚀 Backfilling All Client Leads"
echo "=================================="
echo ""

# Array of all active clients (in alphabetical order as they appear in Supabase)
CLIENTS=(
  "ATI"
  "Boring Book Keeping"
  "Danny Schwartz"
  "David Amiri"
  "Devin Hodo"
  "Gregg Blanchard"
  "Jason Binyon"
  "Jeff Schroder"
  "John Roberts"
  "Kim Wallace"
  "Kirk Hodgson"
  "Koppa Analytics"
  "Littlegiant"
  "LongRun"
  "Maverick In-house"
  "Nick Sakha"
  "Ozment Media"
  "Radiant Energy"
  "Rob Russell"
  "Shane Miller"
  "SMA Insurance"
  "StreetSmart Commercial"
  "Tony Schmitz"
  "Workspark"
)

TOTAL=${#CLIENTS[@]}
SUCCESSFUL=0
FAILED=0

echo "Found $TOTAL clients to process"
echo ""

for i in "${!CLIENTS[@]}"; do
  CLIENT="${CLIENTS[$i]}"
  NUM=$((i + 1))

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$NUM/$TOTAL] Processing: $CLIENT"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/backfill-single-client.sh" "$CLIENT"; then
    ((SUCCESSFUL++))
    echo "✅ SUCCESS: $CLIENT"
  else
    ((FAILED++))
    echo "❌ FAILED: $CLIENT"
  fi

  # Delay between clients to avoid rate limiting
  if [ $NUM -lt $TOTAL ]; then
    echo ""
    echo "⏳ Waiting 5 seconds before next client..."
    sleep 5
    echo ""
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 BACKFILL SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Clients:    $TOTAL"
echo "Successful:       $SUCCESSFUL"
echo "Failed:           $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ All clients backfilled successfully!"
else
  echo "⚠️  Some clients failed - review the output above"
  exit 1
fi
