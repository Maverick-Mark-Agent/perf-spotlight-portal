#!/bin/bash

API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BASE_URL='https://send.maverickmarketingllc.com/api'

echo "Fetching one lead from workspace 25 with tag 264..."
curl -s "${BASE_URL}/leads?workspace_id=25&tag_ids[]=264&page=1&per_page=1" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.data[0] | keys'
