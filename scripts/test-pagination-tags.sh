#!/bin/bash

API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BASE_URL='https://send.maverickmarketingllc.com/api'

echo "Testing if tags are returned when paginating..."
echo ""
echo "First lead from page 1:"
curl -s "${BASE_URL}/leads?workspace_id=25&page=1&per_page=1" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.data[0] | {email, has_tags: (.tags != null), tags: .tags}'
