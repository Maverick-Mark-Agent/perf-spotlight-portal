#!/bin/bash

AIRTABLE_API_KEY="patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730"
BASE_ID="appONMVSIf5czukkf"
TABLE_NAME="Positive Replies"

count=0
offset=""

echo "Counting Kim Wallace records in Airtable..."

while true; do
  if [ -z "$offset" ]; then
    url="https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?pageSize=100"
  else
    url="https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?pageSize=100&offset=${offset}"
  fi

  response=$(curl -s "$url" -H "Authorization: Bearer ${AIRTABLE_API_KEY}")

  batch_count=$(echo "$response" | jq '[.records[] | select(.fields["Workspace Name"] == "Kim Wallace")] | length')
  count=$((count + batch_count))

  echo "Batch: $batch_count (Total so far: $count)"

  offset=$(echo "$response" | jq -r '.offset // empty')

  if [ -z "$offset" ]; then
    break
  fi
done

echo ""
echo "=== FINAL COUNT ==="
echo "Kim Wallace records: $count"
