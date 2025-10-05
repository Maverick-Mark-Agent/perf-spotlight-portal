#!/bin/bash

# Count interested leads for David Amiri (workspace 25)
API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"

echo "Fetching total leads for David Amiri..."
total=$(curl -s -X GET "${BASE_URL}/leads?workspace_id=25&per_page=1" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq -r '.meta.total')

echo "Total leads: $total"
echo ""
echo "Sampling pages to find interested leads..."

# Sample every 100th page to estimate
interested_count=0
for page in 1 100 200 300 400 500; do
  count=$(curl -s -X GET "${BASE_URL}/leads?workspace_id=25&page=${page}&per_page=100" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Accept: application/json" | \
    jq '[.data[] | select(.lead_campaign_data != null and .lead_campaign_data != [] and ([.lead_campaign_data[] | .interested] | any))] | length')

  echo "Page $page: $count interested leads"
  interested_count=$((interested_count + count))
done

echo ""
echo "Found $interested_count interested leads in sampled pages"
