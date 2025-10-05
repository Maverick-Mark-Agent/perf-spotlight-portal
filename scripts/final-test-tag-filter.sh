#!/bin/bash

API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BASE_URL='https://send.maverickmarketingllc.com/api'

echo "Test 1: Leads with workspace_id=25 and tag_ids[]=264"
curl -s "${BASE_URL}/leads?workspace_id=25&tag_ids%5B%5D=264&per_page=5" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '{total: .meta.total, leads: [.data[] | {email, tags: [.tags[] | .name]}]}'

echo ""
echo "Test 2: Search for rvalliejr (known interested lead)"
curl -s "${BASE_URL}/leads?workspace_id=25&search=rvalliejr" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '{total: .meta.total, leads: [.data[] | {email, tags: [.tags[] | .name]}]}'
