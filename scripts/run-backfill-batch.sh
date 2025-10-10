#!/bin/bash

# Run backfill in batches to avoid timeouts and workspace switching issues
# Usage: ./run-backfill-batch.sh [batch_number]
# Batch 1: Clients 1-6
# Batch 2: Clients 7-12
# Batch 3: Clients 13-18
# Batch 4: Clients 19-24

BATCH=${1:-1}

# All 24 clients in alphabetical order
ALL_CLIENTS=(
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

# Calculate start and end indices for this batch
START_IDX=$(( (BATCH - 1) * 6 ))
END_IDX=$(( START_IDX + 6 ))

if [ $START_IDX -ge ${#ALL_CLIENTS[@]} ]; then
  echo "❌ Invalid batch number. Only 4 batches available."
  exit 1
fi

if [ $END_IDX -gt ${#ALL_CLIENTS[@]} ]; then
  END_IDX=${#ALL_CLIENTS[@]}
fi

BATCH_CLIENTS=("${ALL_CLIENTS[@]:$START_IDX:6}")

echo "🚀 Running Batch $BATCH (Clients $((START_IDX + 1))-$END_IDX)"
echo "================================================================"
echo ""

for i in "${!BATCH_CLIENTS[@]}"; do
  CLIENT="${BATCH_CLIENTS[$i]}"
  NUM=$((START_IDX + i + 1))

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$NUM/24] Processing: $CLIENT"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/backfill-single-client.sh" "$CLIENT"

  if [ $? -eq 0 ]; then
    echo "✅ SUCCESS: $CLIENT"
  else
    echo "❌ FAILED: $CLIENT"
  fi

  # CRITICAL: 10 second delay between clients to ensure workspace context is clean
  if [ $i -lt $((${#BATCH_CLIENTS[@]} - 1)) ]; then
    echo ""
    echo "⏳ Waiting 10 seconds before next client..."
    sleep 10
    echo ""
  fi
done

echo ""
echo "✅ Batch $BATCH complete!"
echo ""
echo "Next steps:"
if [ $BATCH -lt 4 ]; then
  echo "  Run batch $((BATCH + 1)): ./run-backfill-batch.sh $((BATCH + 1))"
else
  echo "  All batches complete! Run diagnostic: npx tsx scripts/diagnostic-full-comparison.ts"
fi
