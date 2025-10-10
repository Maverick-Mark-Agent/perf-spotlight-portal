#!/bin/bash

# =============================================================================
# BACKFILL KPI METRICS - Initial Data Population
# =============================================================================
#
# Purpose: Populate client_metrics table with current MTD data
# Run this ONCE to initialize the table, then daily sync takes over
#
# What it does:
# 1. Calls sync-daily-kpi-metrics Edge Function to populate today's data
# 2. Verifies data was inserted successfully
# 3. Shows summary of metrics for each client
#
# =============================================================================

set -e  # Exit on error

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

echo "=========================================="
echo "BACKFILL KPI METRICS - INITIAL SYNC"
echo "=========================================="
echo ""
echo "Date: $(date)"
echo ""

# Step 1: Call the sync Edge Function
echo "Step 1: Calling sync-daily-kpi-metrics Edge Function..."
echo ""

RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sync-daily-kpi-metrics" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manual_trigger": true}')

echo "$RESPONSE" | jq .

# Check if successful
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
  echo ""
  echo "❌ Sync failed!"
  echo "$RESPONSE" | jq -r '.error'
  exit 1
fi

TOTAL=$(echo "$RESPONSE" | jq -r '.total_clients')
SUCCESSFUL=$(echo "$RESPONSE" | jq -r '.successful')
FAILED=$(echo "$RESPONSE" | jq -r '.failed')
DURATION=$(echo "$RESPONSE" | jq -r '.duration_ms')

echo ""
echo "✅ Sync completed successfully!"
echo "   Total clients: $TOTAL"
echo "   Successful: $SUCCESSFUL"
echo "   Failed: $FAILED"
echo "   Duration: ${DURATION}ms"
echo ""

# Step 2: Verify data in database
echo "Step 2: Verifying data in client_metrics table..."
echo ""

METRICS=$(curl -s "$SUPABASE_URL/rest/v1/client_metrics?select=workspace_name,positive_replies_mtd,projection_positive_replies_eom,mtd_leads_progress&metric_type=eq.mtd&order=positive_replies_mtd.desc&limit=100" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY")

RECORD_COUNT=$(echo "$METRICS" | jq 'length')

if [ "$RECORD_COUNT" -eq 0 ]; then
  echo "⚠️  Warning: No records found in client_metrics table"
  echo "   This may indicate a sync failure"
  exit 1
fi

echo "✅ Found $RECORD_COUNT metric records"
echo ""
echo "Top 10 Clients by MTD Leads:"
echo ""

echo "$METRICS" | jq -r '.[] | "\(.workspace_name): \(.positive_replies_mtd) MTD, \(.projection_positive_replies_eom) projected, \(.mtd_leads_progress)% progress"' | head -10

echo ""
echo "=========================================="
echo "BACKFILL COMPLETE"
echo "=========================================="
echo ""
echo "✅ KPI metrics table is now populated!"
echo ""
echo "Next steps:"
echo "1. Deploy the sync-daily-kpi-metrics Edge Function"
echo "2. Run the pg_cron migration to schedule daily syncs"
echo "3. KPI Dashboard will now use real-time database queries"
echo ""
