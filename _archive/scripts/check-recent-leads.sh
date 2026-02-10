#!/bin/bash

# Check recent leads added to David Amiri pipeline

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

echo "Checking recent leads for David Amiri..."
echo ""

curl -s "${SUPABASE_URL}/rest/v1/client_leads?workspace_name=eq.David%20Amiri&order=created_at.desc&limit=5&select=id,first_name,last_name,lead_email,pipeline_stage,created_at" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | python3 -m json.tool
