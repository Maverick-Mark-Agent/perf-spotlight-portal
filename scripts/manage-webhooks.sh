#!/bin/bash

# Webhook management utility for Email Bison
# Lists, tests, and manages webhooks

API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"

function show_help() {
  echo "Webhook Management Utility"
  echo ""
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  list              List all webhooks"
  echo "  test [id]         Send a test event to webhook"
  echo "  delete [id]       Delete a webhook by ID"
  echo "  events            Show all available event types"
  echo ""
}

function list_webhooks() {
  echo "Fetching all webhooks..."
  echo ""

  RESPONSE=$(curl -s -X GET "${BASE_URL}/webhook-url" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Accept: application/json")

  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
}

function test_webhook() {
  local WEBHOOK_ID=$1

  if [ -z "$WEBHOOK_ID" ]; then
    echo "Error: Webhook ID required"
    echo "Usage: $0 test [webhook_id]"
    exit 1
  fi

  echo "Getting webhook details..."
  WEBHOOK=$(curl -s -X GET "${BASE_URL}/webhook-url/${WEBHOOK_ID}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Accept: application/json")

  WEBHOOK_URL=$(echo "$WEBHOOK" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['url'])" 2>/dev/null)

  if [ -z "$WEBHOOK_URL" ]; then
    echo "Error: Could not find webhook with ID $WEBHOOK_ID"
    exit 1
  fi

  echo "Sending test 'lead_interested' event to: $WEBHOOK_URL"
  echo ""

  RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-events/test-event" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{
      "event_type": "lead_interested",
      "url": "'"${WEBHOOK_URL}"'"
    }')

  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
}

function delete_webhook() {
  local WEBHOOK_ID=$1

  if [ -z "$WEBHOOK_ID" ]; then
    echo "Error: Webhook ID required"
    echo "Usage: $0 delete [webhook_id]"
    exit 1
  fi

  echo "Deleting webhook ID: $WEBHOOK_ID"
  echo ""

  RESPONSE=$(curl -s -X DELETE "${BASE_URL}/webhook-url/${WEBHOOK_ID}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Accept: application/json")

  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
}

function show_events() {
  echo "Available webhook event types:"
  echo ""

  RESPONSE=$(curl -s -X GET "${BASE_URL}/webhook-events/event-types" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Accept: application/json")

  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
}

# Main script
case "$1" in
  list)
    list_webhooks
    ;;
  test)
    test_webhook "$2"
    ;;
  delete)
    delete_webhook "$2"
    ;;
  events)
    show_events
    ;;
  *)
    show_help
    ;;
esac
