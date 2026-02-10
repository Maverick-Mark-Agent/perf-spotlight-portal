#!/bin/bash

API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BASE_URL='https://send.maverickmarketingllc.com/api'

echo "Fetching leads and checking for interested field..."
curl -s "${BASE_URL}/leads?workspace_id=25&page=1&per_page=100" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.data[] | select(.lead_campaign_data != null and .lead_campaign_data != [] and ([.lead_campaign_data[] | .interested] | any)) | {id, email, interested_campaigns: [.lead_campaign_data[] | select(.interested == true) | .campaign_id]}' | head -30
