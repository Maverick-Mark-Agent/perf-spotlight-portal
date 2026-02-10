#!/bin/bash

API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BASE_URL='https://send.maverickmarketingllc.com/api'

echo "Searching for rvalliejr@gmail.com..."
curl -s "${BASE_URL}/leads?workspace_id=25&search=rvalliejr@gmail.com" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.data[0] | {email, tags}'
