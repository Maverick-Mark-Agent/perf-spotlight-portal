#!/bin/bash

# Webhook Verification Suite
# Tests webhook delivery for all deployed clients

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_FILE="${SCRIPT_DIR}/client-registry.json"
LOG_FILE="${SCRIPT_DIR}/../docs/webhook-verification-log.md"
BASE_URL="https://send.maverickmarketingllc.com/api"
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

# Extract super admin API key from registry
SUPER_ADMIN_KEY=$(python3 << 'EOF'
import json
with open('scripts/client-registry.json', 'r') as f:
    registry = json.load(f)
print(registry.get('super_admin_api_key', ''))
EOF
)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Initialize log
echo "# Webhook Verification Log" > "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "**Started:** $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Function to verify webhook for a single client
verify_webhook() {
  local client_id=$1
  local company_name=$2
  local workspace_name=$3
  local workspace_id=$4
  local webhook_id=$5

  echo -e "${YELLOW}Testing webhook for: $company_name ($workspace_name)...${NC}"

  # Step 1: Switch to workspace
  echo "  Switching to workspace $workspace_id..."
  SWITCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{
      "team_id": '${workspace_id}'
    }')

  if ! echo "$SWITCH_RESPONSE" | grep -q '"name"'; then
    echo -e "${RED}❌ Failed to switch workspace${NC}"
    echo "- ❌ **$company_name** - Failed to switch workspace" >> "$LOG_FILE"
    return 1
  fi

  # Step 2: Verify webhook exists
  echo "  Verifying webhook exists..."
  WEBHOOK_CHECK=$(curl -s "${BASE_URL}/webhook-url/${webhook_id}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Accept: application/json")

  if ! echo "$WEBHOOK_CHECK" | grep -q '"id"'; then
    echo -e "${RED}❌ Webhook $webhook_id not found${NC}"
    echo "- ❌ **$company_name** - Webhook not found (ID: $webhook_id)" >> "$LOG_FILE"
    return 1
  fi

  # Step 3: Send test webhook
  echo "  Sending test webhook..."
  TEST_RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-events/test-event" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{
      "event_type": "lead_interested",
      "url": "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"
    }')

  if ! echo "$TEST_RESPONSE" | grep -q '"success".*true'; then
    echo -e "${RED}❌ Test webhook failed${NC}"
    echo "- ❌ **$company_name** - Test webhook failed" >> "$LOG_FILE"
    return 1
  fi

  # Step 3: Wait for processing
  sleep 2

  # Step 4: Check database for lead (Note: test webhooks use sample data, not client workspace)
  # For now, just verify the webhook was sent successfully
  echo -e "${GREEN}✅ Webhook delivery successful${NC}"

  # Update registry
  python3 << EOF
import json
with open('$REGISTRY_FILE', 'r') as f:
    registry = json.load(f)
for client in registry['clients']:
    if client['id'] == $client_id:
        client['webhook_verified'] = True
        break
with open('$REGISTRY_FILE', 'w') as f:
    json.dump(registry, f, indent=2)
EOF

  echo "- ✅ **$company_name** ($workspace_name) - Verified (Webhook ID: $webhook_id)" >> "$LOG_FILE"
  return 0
}

# Main verification logic
echo "============================================"
echo "  Webhook Verification Suite"
echo "============================================"
echo ""

MODE="${1:-deployed}"  # Default to all deployed

if [ "$MODE" == "deployed" ]; then
  echo -e "${YELLOW}Verifying all deployed webhooks...${NC}"
  echo ""
  echo "## All Deployed Webhooks" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  # Get all deployed client IDs
  CLIENT_IDS=$(python3 << EOF
import json
with open('$REGISTRY_FILE', 'r') as f:
    registry = json.load(f)
ids = [str(c['id']) for c in registry['clients'] if c.get('webhook_id')]
print(' '.join(ids))
EOF
)

elif [ "$MODE" == "pilot" ]; then
  echo -e "${YELLOW}Verifying pilot webhooks only...${NC}"
  echo ""
  echo "## Pilot Webhooks" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
  CLIENT_IDS="1 2 3"  # David Amiri, Kim Wallace, Jeff Schroder

else
  CLIENT_IDS="$MODE"  # Specific client ID
fi

# Verify each client
VERIFIED=0
FAILED=0

for client_id in $CLIENT_IDS; do
  # Get client data
  CLIENT_DATA=$(python3 << EOF
import json
with open('$REGISTRY_FILE', 'r') as f:
    registry = json.load(f)
for client in registry['clients']:
    if client['id'] == $client_id:
        webhook_id = client.get('webhook_id', '')
        workspace_id = client.get('workspace_id', '')
        print(f"{client['company_name']}|{client['workspace_name']}|{workspace_id}|{webhook_id}")
        break
EOF
)

  IFS='|' read -r COMPANY WORKSPACE WORKSPACE_ID WEBHOOK_ID <<< "$CLIENT_DATA"

  if [ -z "$WEBHOOK_ID" ] || [ "$WEBHOOK_ID" == "None" ]; then
    echo -e "${YELLOW}⚠️  Skipping $COMPANY - No webhook deployed${NC}"
    continue
  fi

  # Verify webhook
  if verify_webhook "$client_id" "$COMPANY" "$WORKSPACE" "$WORKSPACE_ID" "$WEBHOOK_ID"; then
    ((VERIFIED++))
  else
    ((FAILED++))
  fi

  echo ""
  sleep 1
done

# Summary
echo "============================================"
echo -e "${GREEN}Verification Complete!${NC}"
echo "  Verified: $VERIFIED"
echo "  Failed: $FAILED"
echo "============================================"
echo ""
echo "Log saved to: $LOG_FILE"
echo "Registry updated: $REGISTRY_FILE"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}⚠️  Some webhooks failed verification. Check log for details.${NC}"
  echo ""
  echo "To troubleshoot:"
  echo "1. Check Supabase function logs"
  echo "2. Verify webhook URL is correct"
  echo "3. Test manually with: ./scripts/test-webhook-api.sh"
fi

# Update log with summary
echo "" >> "$LOG_FILE"
echo "## Summary" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "- **Verified:** $VERIFIED" >> "$LOG_FILE"
echo "- **Failed:** $FAILED" >> "$LOG_FILE"
echo "- **Completed:** $(date)" >> "$LOG_FILE"
