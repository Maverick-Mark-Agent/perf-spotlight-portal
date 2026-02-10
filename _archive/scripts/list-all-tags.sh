#!/bin/bash

API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BASE_URL='https://send.maverickmarketingllc.com/api'

echo "All tags for workspace 25:"
curl -s "${BASE_URL}/tags?workspace_id=25" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.data[] | {id, name, default}'
