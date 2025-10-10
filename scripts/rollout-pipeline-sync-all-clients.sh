#!/bin/bash

# =============================================================================
# ROLLOUT SCRIPT: Pipeline Sync for All Active Clients
# =============================================================================
#
# Purpose: Sync interested leads pipeline for all 24 active clients
# Based on: Devin Hodo verified solution (42/42 leads, 100% success)
# Tested on: David Amiri (211/211 leads, 100% success)
#
# Data Flow:
# 1. Email Bison /api/replies?status=interested → Get all interested replies
# 2. For each reply.lead_id → Fetch /api/leads/{lead_id} for full details
# 3. Extract: phone from custom_variables, conversation URL, all metadata
# 4. Upsert to client_leads table (preserves pipeline_stage if exists)
#
# =============================================================================

set -e  # Exit on error

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

echo "=========================================="
echo "PIPELINE SYNC ROLLOUT - ALL ACTIVE CLIENTS"
echo "=========================================="
echo ""
echo "Date: $(date)"
echo "Target: 24 active clients"
echo ""

# Fetch list of active clients
echo "Fetching active clients..."
CLIENTS=$(curl -s "$SUPABASE_URL/rest/v1/client_registry?select=workspace_name&is_active=eq.true&order=workspace_name.asc" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq -r '.[].workspace_name')

CLIENT_COUNT=$(echo "$CLIENTS" | wc -l | tr -d ' ')
echo "Found $CLIENT_COUNT active clients"
echo ""

# Confirmation prompt
read -p "Proceed with syncing all $CLIENT_COUNT clients? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Sync cancelled."
  exit 0
fi

echo ""
echo "Starting sync..."
echo ""

# Results tracking
TOTAL_CLIENTS=0
SUCCESSFUL=0
FAILED=0
TOTAL_LEADS=0

# Log file
LOG_FILE="pipeline-sync-rollout-$(date +%Y%m%d-%H%M%S).log"
echo "Logging to: $LOG_FILE"
echo ""

# Process each client
while IFS= read -r CLIENT_NAME; do
  TOTAL_CLIENTS=$((TOTAL_CLIENTS + 1))

  echo "[$TOTAL_CLIENTS/$CLIENT_COUNT] $CLIENT_NAME" | tee -a "$LOG_FILE"
  echo "  Syncing..." | tee -a "$LOG_FILE"

  # Call sync function
  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sync-client-pipeline" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_name\": \"$CLIENT_NAME\"}" 2>&1)

  # Parse response
  STATUS=$(echo "$RESPONSE" | jq -r '.results[0].status // "unknown"')
  LEADS_SYNCED=$(echo "$RESPONSE" | jq -r '.results[0].leads_synced // 0')
  ERROR=$(echo "$RESPONSE" | jq -r '.results[0].error // ""')

  if [ "$STATUS" = "success" ]; then
    SUCCESSFUL=$((SUCCESSFUL + 1))
    TOTAL_LEADS=$((TOTAL_LEADS + LEADS_SYNCED))
    echo "  ✅ Success: $LEADS_SYNCED leads synced" | tee -a "$LOG_FILE"
  else
    FAILED=$((FAILED + 1))
    echo "  ❌ Failed: $ERROR" | tee -a "$LOG_FILE"
  fi

  echo "" | tee -a "$LOG_FILE"

  # Delay between clients to avoid rate limits
  if [ $TOTAL_CLIENTS -lt $CLIENT_COUNT ]; then
    sleep 3
  fi

done <<< "$CLIENTS"

# Summary
echo "=========================================="  | tee -a "$LOG_FILE"
echo "ROLLOUT COMPLETE"  | tee -a "$LOG_FILE"
echo "=========================================="  | tee -a "$LOG_FILE"
echo ""  | tee -a "$LOG_FILE"
echo "Total Clients:   $TOTAL_CLIENTS"  | tee -a "$LOG_FILE"
echo "Successful:      $SUCCESSFUL"  | tee -a "$LOG_FILE"
echo "Failed:          $FAILED"  | tee -a "$LOG_FILE"
echo "Total Leads:     $TOTAL_LEADS"  | tee -a "$LOG_FILE"
echo ""  | tee -a "$LOG_FILE"
echo "Success Rate:    $(echo "scale=2; $SUCCESSFUL * 100 / $TOTAL_CLIENTS" | bc)%"  | tee -a "$LOG_FILE"
echo ""  | tee -a "$LOG_FILE"

if [ $FAILED -gt 0 ]; then
  echo "⚠️  Some clients failed. Review log: $LOG_FILE"
  exit 1
else
  echo "✅ All clients synced successfully!"
  exit 0
fi
