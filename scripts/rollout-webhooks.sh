#!/bin/bash

# Automated Webhook Rollout Script
# Deploys "Lead Interested" webhooks for all ready clients

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_FILE="${SCRIPT_DIR}/client-registry.json"
LOG_FILE="${SCRIPT_DIR}/../docs/webhook-rollout-log.md"
BASE_URL="https://send.maverickmarketingllc.com/api"
WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if registry exists
if [ ! -f "$REGISTRY_FILE" ]; then
  echo -e "${RED}Error: Client registry not found at $REGISTRY_FILE${NC}"
  exit 1
fi

# Extract super admin API key from registry
SUPER_ADMIN_KEY=$(python3 << 'EOF'
import json
with open('scripts/client-registry.json', 'r') as f:
    registry = json.load(f)
print(registry.get('super_admin_api_key', ''))
EOF
)

if [ -z "$SUPER_ADMIN_KEY" ]; then
  echo -e "${RED}Error: super_admin_api_key not found in registry${NC}"
  exit 1
fi

# Initialize log
echo "# Webhook Rollout Log" > "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "**Started:** $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Function to deploy webhook for a single client
deploy_webhook() {
  local client_id=$1
  local company_name=$2
  local workspace_name=$3
  local workspace_id=$4

  echo -e "${YELLOW}Deploying webhook for: $company_name ($workspace_name, workspace ID: $workspace_id)...${NC}"

  # Step 1: Switch to target workspace
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
    echo "Switch response: $SWITCH_RESPONSE"
    echo "- ❌ **$company_name** ($workspace_name) - Failed to switch workspace: $SWITCH_RESPONSE" >> "$LOG_FILE"
    return 1
  fi

  echo "  Workspace switched successfully"

  # Step 2: Create webhook via API (using same super admin key, now in correct workspace context)
  echo "  Creating webhook..."
  RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-url" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d '{
      "name": "Client Portal Pipeline - Interested Leads",
      "url": "'"${WEBHOOK_URL}"'",
      "events": ["lead_interested"]
    }')

  # Check if successful
  if echo "$RESPONSE" | grep -q '"id"'; then
    WEBHOOK_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
    echo -e "${GREEN}✅ Success! Webhook ID: $WEBHOOK_ID${NC}"

    # Update registry
    python3 << EOF
import json
with open('$REGISTRY_FILE', 'r') as f:
    registry = json.load(f)
for client in registry['clients']:
    if client['id'] == $client_id:
        client['webhook_id'] = $WEBHOOK_ID
        client['status'] = 'deployed'
        break
with open('$REGISTRY_FILE', 'w') as f:
    json.dump(registry, f, indent=2)
EOF

    # Log success
    echo "- ✅ **$company_name** ($workspace_name) - Webhook ID: $WEBHOOK_ID" >> "$LOG_FILE"
    return 0
  else
    echo -e "${RED}❌ Failed for $company_name${NC}"
    echo "Response: $RESPONSE"

    # Log failure
    echo "- ❌ **$company_name** ($workspace_name) - Failed: $RESPONSE" >> "$LOG_FILE"
    return 1
  fi
}

# Main rollout logic
echo "============================================"
echo "  Webhook Rollout - Multi-Client Deployment"
echo "============================================"
echo ""

# Parse mode argument
MODE="${1:-pilot}"  # Default to pilot mode

if [ "$MODE" == "pilot" ]; then
  echo -e "${YELLOW}Running in PILOT mode (Kim Wallace, Jeff Schroder only)${NC}"
  echo ""
  echo "## Pilot Rollout" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  # Deploy only pilot clients (IDs updated after registry cleanup)
  BATCH_IDS=(2 3)  # Kim Wallace, Jeff Schroder

elif [ "$MODE" == "batch" ]; then
  BATCH_NUM="${2:-1}"
  echo -e "${YELLOW}Running BATCH $BATCH_NUM rollout${NC}"
  echo ""
  echo "## Batch $BATCH_NUM Rollout" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  # Define batches (5 clients each)
  case $BATCH_NUM in
    1) BATCH_IDS=(4 5 7 8 9) ;;      # ATI, Binyon, Danny, Devin, Gregg
    2) BATCH_IDS=(10 11 13 14 15) ;; # John, Kirk, Nick, Rick, Rob
    3) BATCH_IDS=(16 17 19 20 21) ;; # SMA, Shane, StreetSmart Comm, P&C, Trucking
    4) BATCH_IDS=(22) ;;              # Tony
    *) echo -e "${RED}Invalid batch number${NC}"; exit 1 ;;
  esac

elif [ "$MODE" == "full" ]; then
  echo -e "${YELLOW}Running FULL rollout (all ready clients)${NC}"
  echo ""
  read -p "Are you sure you want to deploy to ALL clients? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi

  echo "## Full Rollout" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  # All ready client IDs (excluding blocked ones)
  BATCH_IDS=(2 3 4 5 7 8 9 10 11 13 14 15 16 17 19 20 21 22)

else
  echo -e "${RED}Invalid mode. Use: pilot, batch [num], or full${NC}"
  exit 1
fi

# Get client data and deploy
DEPLOYED=0
FAILED=0

for client_id in "${BATCH_IDS[@]}"; do
  # Extract client data from registry
  CLIENT_DATA=$(python3 << EOF
import json
with open('$REGISTRY_FILE', 'r') as f:
    registry = json.load(f)
for client in registry['clients']:
    if client['id'] == $client_id:
        print(f"{client['company_name']}|{client['workspace_name']}|{client['workspace_id']}")
        break
EOF
)

  IFS='|' read -r COMPANY WORKSPACE WORKSPACE_ID <<< "$CLIENT_DATA"

  if [ -z "$WORKSPACE_ID" ] || [ "$WORKSPACE_ID" == "None" ] || [ "$WORKSPACE_ID" == "null" ]; then
    echo -e "${YELLOW}⚠️  Skipping $COMPANY - No workspace ID${NC}"
    echo "- ⚠️  **$COMPANY** - Skipped (no workspace ID)" >> "$LOG_FILE"
    continue
  fi

  # Deploy webhook
  if deploy_webhook "$client_id" "$COMPANY" "$WORKSPACE" "$WORKSPACE_ID"; then
    ((DEPLOYED++))
  else
    ((FAILED++))
  fi

  echo ""
  sleep 1  # Rate limiting
done

# Summary
echo "============================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "  Deployed: $DEPLOYED"
echo "  Failed: $FAILED"
echo "============================================"
echo ""
echo "Log saved to: $LOG_FILE"
echo "Registry updated: $REGISTRY_FILE"
echo ""
echo "Next steps:"
echo "1. Run ./scripts/verify-webhook-delivery.sh to test"
echo "2. Check $LOG_FILE for details"

# Update log with summary
echo "" >> "$LOG_FILE"
echo "## Summary" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "- **Deployed:** $DEPLOYED" >> "$LOG_FILE"
echo "- **Failed:** $FAILED" >> "$LOG_FILE"
echo "- **Completed:** $(date)" >> "$LOG_FILE"
