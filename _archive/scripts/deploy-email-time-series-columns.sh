#!/bin/bash

# Deploy email time-series columns to client_metrics table

echo "==========================================
ADD EMAIL TIME-SERIES COLUMNS
=========================================="

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

SQL="
ALTER TABLE public.client_metrics
  ADD COLUMN IF NOT EXISTS emails_sent_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_sent_last_7_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_sent_last_14_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_sent_last_30_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_scheduled_today INTEGER DEFAULT 0;
"

echo "Running SQL migration..."
echo "$SQL"

curl -s "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": $(echo "$SQL" | jq -Rs .)}"

echo ""
echo "✅ Migration completed"
echo ""
echo "Now run: ./scripts/backfill-kpi-metrics.sh"
