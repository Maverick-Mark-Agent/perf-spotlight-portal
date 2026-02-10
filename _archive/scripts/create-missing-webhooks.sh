#!/bin/bash

# Create Missing Webhooks Script
# Automatically creates webhooks for clients that don't have them

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://send.maverickmarketingllc.com/api"

echo "============================================"
echo "  Creating Missing Webhooks"
echo "============================================"
echo ""

# Clients missing webhooks (from verification report)
# Format: "CLIENT_NAME:WORKSPACE_ID"
MISSING_WEBHOOKS=(
  "David Amiri:25"
  "Kim Wallace:4"
  "Jeff Schroder:26"
  "ATI:5"
  "Jason Binyon:3"
  "Rick Huemmer:27"
  "Rob Russell:24"
  "Shane Miller:12"
  "StreetSmart Commercial:29"
  "StreetSmart P&C:22"
  "StreetSmart Trucking:9"
)

CREATED=0
FAILED=0
ALREADY_EXISTS=0

for client_info in "${MISSING_WEBHOOKS[@]}"; do
  IFS=':' read -r CLIENT_NAME WORKSPACE_ID <<< "$client_info"

  echo -e "${CYAN}Processing: $CLIENT_NAME (Workspace $WORKSPACE_ID)${NC}"

  # Switch workspace
  curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_id\": ${WORKSPACE_ID}}" > /dev/null

  sleep 2

  # Check if webhook already exists
  EXISTING=$(curl -s -X GET "${BASE_URL}/webhook-url" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  if echo "$EXISTING" | jq -e '.data[] | select(.url | contains("bison-interested-webhook"))' > /dev/null 2>&1; then
    EXISTING_ID=$(echo "$EXISTING" | jq -r '.data[] | select(.url | contains("bison-interested-webhook")) | .id')
    echo -e "  ${YELLOW}⚠ Webhook already exists (ID: $EXISTING_ID)${NC}"
    ((ALREADY_EXISTS++))
    continue
  fi

  # Create webhook
  RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-url" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"url\": \"${WEBHOOK_URL}\",
      \"event\": \"LEAD_INTERESTED\"
    }")

  if echo "$RESPONSE" | jq -e '.data.id' > /dev/null 2>&1; then
    NEW_WEBHOOK_ID=$(echo "$RESPONSE" | jq -r '.data.id')
    echo -e "  ${GREEN}✓ Created webhook (ID: $NEW_WEBHOOK_ID)${NC}"
    ((CREATED++))

    # Update client registry
    echo "  Updating registry..."
    # Note: Manual registry update needed - this is for logging only
  else
    echo -e "  ${RED}✗ Failed to create webhook${NC}"
    echo "  Response: $(echo $RESPONSE | jq -r '.message // .error // "Unknown error"')"
    ((FAILED++))
  fi

  echo ""
done

echo "============================================"
echo "  SUMMARY"
echo "============================================"
echo -e "Created:        ${GREEN}$CREATED${NC}"
echo -e "Already Exists: ${YELLOW}$ALREADY_EXISTS${NC}"
echo -e "Failed:         ${RED}$FAILED${NC}"
echo ""

if [ $CREATED -gt 0 ]; then
  echo -e "${YELLOW}⚠ Important:${NC}"
  echo "  Update client-registry.json with new webhook IDs"
  echo "  Run: ./scripts/verify-all-webhooks.sh to confirm"
fi
