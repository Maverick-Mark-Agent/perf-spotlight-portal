#!/bin/bash

# Test Email Bison API call for David Amiri interested leads

export API_KEY='77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
BASE_URL='https://send.maverickmarketingllc.com/api'
WORKSPACE_ID=25
TAG_ID=190

echo "Testing API call for workspace ${WORKSPACE_ID}, tag ${TAG_ID}..."

# First test: get all leads (no filter)
echo "Test 1: All leads for workspace 25"
curl -s "${BASE_URL}/leads?workspace_id=${WORKSPACE_ID}&per_page=1" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.meta.total'

echo ""
echo "Test 2: Leads with tag filter (format 1: filters[tag_ids][])"
curl -s "${BASE_URL}/leads?workspace_id=${WORKSPACE_ID}&filters[tag_ids][]=${TAG_ID}&per_page=1" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.meta.total'

echo ""
echo "Test 3: Leads with tag filter (format 2: filters[tag_ids][0])"
curl -s "${BASE_URL}/leads?workspace_id=${WORKSPACE_ID}&filters[tag_ids][0]=${TAG_ID}&per_page=1" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Accept: application/json" | jq '.meta.total'
