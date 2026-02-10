#!/bin/bash

# Tier 1 Rollout - High Volume Clients (1,009 total leads)
# StreetSmart Trucking, Jason Binyon, John Roberts, StreetSmart P&C, Rob Russell

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SCRIPT="${SCRIPT_DIR}/sync-workspace-leads.sh"

chmod +x "$SYNC_SCRIPT"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TIER 1 ROLLOUT - High Volume Clients"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. StreetSmart Trucking (363 interested)
echo -e "${CYAN}[1/5] StreetSmart Trucking - 363 expected${NC}"
"$SYNC_SCRIPT" 9 "StreetSmart Trucking"
echo ""

# 2. Jason Binyon (334 interested)
echo -e "${CYAN}[2/5] Jason Binyon - 334 expected${NC}"
"$SYNC_SCRIPT" 3 "Jason Binyon"
echo ""

# 3. John Roberts (138 interested)
echo -e "${CYAN}[3/5] John Roberts - 138 expected${NC}"
"$SYNC_SCRIPT" 28 "John Roberts"
echo ""

# 4. StreetSmart P&C (88 interested)
echo -e "${CYAN}[4/5] StreetSmart P&C - 88 expected${NC}"
"$SYNC_SCRIPT" 22 "StreetSmart P&C"
echo ""

# 5. Rob Russell (87 interested)
echo -e "${CYAN}[5/5] Rob Russell - 87 expected${NC}"
"$SYNC_SCRIPT" 24 "Rob Russell"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Tier 1 Rollout Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
