#!/bin/bash

echo "🧪 Testing KPI Dashboard with STATS API Fix..."
echo ""

curl -s -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-workspace-analytics" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 1728446400}' | jq '.clients[] | {name, oct_mtd: .positiveRepliesCurrentMonth, last30: .positiveRepliesLast30Days}' | head -30
