#!/bin/bash

# Webhook Rollback Script
# Emergency rollback - deletes all deployed webhooks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_FILE="${SCRIPT_DIR}/client-registry.json"
LOG_FILE="${SCRIPT_DIR}/../docs/webhook-rollback-log.md"
BASE_URL="https://send.maverickmarketingllc.com/api"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "  ⚠️  WEBHOOK ROLLBACK - EMERGENCY SCRIPT"
echo "============================================"
echo ""
echo -e "${RED}WARNING: This will DELETE all deployed webhooks!${NC}"
echo ""
read -p "Are you absolutely sure? Type 'ROLLBACK' to confirm: " confirm

if [ "$confirm" != "ROLLBACK" ]; then
  echo "Aborted."
  exit 0
fi

# Initialize log
echo "# Webhook Rollback Log" > "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "**Started:** $(date)" >> "$LOG_FILE"
echo "**Reason:** Emergency rollback initiated" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Function to delete webhook
delete_webhook() {
  local client_id=$1
  local company_name=$2
  local api_key=$3
  local webhook_id=$4

  echo -e "${YELLOW}Deleting webhook for: $company_name (ID: $webhook_id)...${NC}"

  # Delete via API
  RESPONSE=$(curl -s -X DELETE "${BASE_URL}/webhook-url/${webhook_id}" \
    -H "Authorization: Bearer ${api_key}" \
    -H "Accept: application/json")

  if echo "$RESPONSE" | grep -q '"success".*true'; then
    echo -e "${GREEN}✅ Deleted successfully${NC}"

    # Update registry
    python3 << EOF
import json
with open('$REGISTRY_FILE', 'r') as f:
    registry = json.load(f)
for client in registry['clients']:
    if client['id'] == $client_id:
        client['webhook_id'] = None
        client['webhook_verified'] = False
        if client['status'] == 'deployed' or client['status'] == 'pilot_deployed':
            client['status'] = 'ready'
        break
with open('$REGISTRY_FILE', 'w') as f:
    json.dump(registry, f, indent=2)
EOF

    echo "- ✅ **$company_name** - Webhook $webhook_id deleted" >> "$LOG_FILE"
    return 0
  else
    echo -e "${RED}❌ Failed to delete${NC}"
    echo "Response: $RESPONSE"
    echo "- ❌ **$company_name** - Failed to delete webhook $webhook_id" >> "$LOG_FILE"
    return 1
  fi
}

# Get all deployed webhooks
echo "Scanning for deployed webhooks..."
echo ""

DEPLOYED_DATA=$(python3 << 'EOF'
import json
with open('scripts/client-registry.json', 'r') as f:
    registry = json.load(f)
for client in registry['clients']:
    if client.get('webhook_id'):
        print(f"{client['id']}|{client['company_name']}|{client['api_key']}|{client['webhook_id']}")
EOF
)

if [ -z "$DEPLOYED_DATA" ]; then
  echo -e "${YELLOW}No deployed webhooks found.${NC}"
  exit 0
fi

# Delete each webhook
DELETED=0
FAILED=0

while IFS='|' read -r CLIENT_ID COMPANY API_KEY WEBHOOK_ID; do
  if delete_webhook "$CLIENT_ID" "$COMPANY" "$API_KEY" "$WEBHOOK_ID"; then
    ((DELETED++))
  else
    ((FAILED++))
  fi
  echo ""
  sleep 1
done <<< "$DEPLOYED_DATA"

# Summary
echo "============================================"
echo -e "${GREEN}Rollback Complete!${NC}"
echo "  Deleted: $DELETED"
echo "  Failed: $FAILED"
echo "============================================"
echo ""
echo "Log saved to: $LOG_FILE"
echo "Registry updated: $REGISTRY_FILE"
echo ""
echo "All webhooks have been removed."
echo "Clients are marked as 'ready' for future deployment."

# Update log with summary
echo "" >> "$LOG_FILE"
echo "## Summary" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "- **Deleted:** $DELETED" >> "$LOG_FILE"
echo "- **Failed:** $FAILED" >> "$LOG_FILE"
echo "- **Completed:** $(date)" >> "$LOG_FILE"
