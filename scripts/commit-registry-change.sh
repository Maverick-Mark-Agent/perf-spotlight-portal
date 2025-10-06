#!/bin/bash

# Git-tracked Registry Update Script
# Updates client-registry.json and creates automatic git commit
#
# Usage:
#   ./scripts/commit-registry-change.sh <client_name> <field> <old_value> <new_value> <reason>
#
# Example:
#   ./scripts/commit-registry-change.sh "John Roberts" "webhook_id" "78" "79" "Webhook recreated after JWT fix"

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_FILE="${SCRIPT_DIR}/client-registry.json"
CHANGELOG_FILE="${SCRIPT_DIR}/../docs/REGISTRY_CHANGELOG.md"

# Check arguments
if [ $# -ne 5 ]; then
  echo -e "${RED}Error: Invalid number of arguments${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 <client_name> <field> <old_value> <new_value> <reason>"
  echo ""
  echo "Example:"
  echo "  $0 \"John Roberts\" \"webhook_id\" \"78\" \"79\" \"Webhook recreated\""
  echo ""
  exit 1
fi

CLIENT_NAME="$1"
FIELD="$2"
OLD_VALUE="$3"
NEW_VALUE="$4"
REASON="$5"

# Validate registry file exists
if [ ! -f "$REGISTRY_FILE" ]; then
  echo -e "${RED}Error: Registry file not found: ${REGISTRY_FILE}${NC}"
  exit 1
fi

# Validate changelog exists (create if not)
if [ ! -f "$CHANGELOG_FILE" ]; then
  echo -e "${YELLOW}Creating changelog file...${NC}"
  cat > "$CHANGELOG_FILE" << 'EOF'
# Client Registry Changelog

This file tracks all changes to the client registry over time.

## Format

Each entry follows this format:
```
YYYY-MM-DD HH:MM | Client Name | field: old → new | Reason
```

## Changes

EOF
fi

echo "============================================"
echo "  Registry Update & Commit"
echo "============================================"
echo ""
echo -e "${CYAN}Client:${NC} ${CLIENT_NAME}"
echo -e "${CYAN}Field:${NC} ${FIELD}"
echo -e "${CYAN}Change:${NC} ${OLD_VALUE} → ${NEW_VALUE}"
echo -e "${CYAN}Reason:${NC} ${REASON}"
echo ""

# Backup registry
cp "$REGISTRY_FILE" "${REGISTRY_FILE}.backup"
echo -e "${GREEN}✓${NC} Registry backed up"

# Find the client and update the field
UPDATED_REGISTRY=$(jq --arg client "$CLIENT_NAME" \
  --arg field "$FIELD" \
  --arg new_value "$NEW_VALUE" \
  '
  .clients |= map(
    if (.company_name == $client or .workspace_name == $client) then
      if $field == "webhook_id" then
        .[$field] = ($new_value | tonumber)
      else
        .[$field] = $new_value
      end
    else
      .
    end
  )
' "$REGISTRY_FILE")

# Check if any client was found
CLIENT_FOUND=$(echo "$UPDATED_REGISTRY" | jq --arg client "$CLIENT_NAME" \
  '[.clients[] | select(.company_name == $client or .workspace_name == $client)] | length')

if [ "$CLIENT_FOUND" -eq 0 ]; then
  echo -e "${RED}✗ Client not found: ${CLIENT_NAME}${NC}"
  rm "${REGISTRY_FILE}.backup"
  exit 1
fi

# Write updated registry
echo "$UPDATED_REGISTRY" > "$REGISTRY_FILE"
echo -e "${GREEN}✓${NC} Registry updated"

# Update last_updated timestamp
UPDATED_REGISTRY=$(jq --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  '.last_updated = $timestamp' "$REGISTRY_FILE")
echo "$UPDATED_REGISTRY" > "$REGISTRY_FILE"

# Append to changelog
TIMESTAMP=$(date +"%Y-%m-%d %H:%M")
CHANGELOG_ENTRY="${TIMESTAMP} | ${CLIENT_NAME} | ${FIELD}: ${OLD_VALUE} → ${NEW_VALUE} | ${REASON}"

echo "$CHANGELOG_ENTRY" >> "$CHANGELOG_FILE"
echo -e "${GREEN}✓${NC} Changelog updated"

# Create git commit
COMMIT_MSG="update: ${CLIENT_NAME} ${FIELD} ${OLD_VALUE} → ${NEW_VALUE}

${REASON}

Updated via commit-registry-change.sh"

git add "$REGISTRY_FILE" "$CHANGELOG_FILE"
git commit -m "$COMMIT_MSG"

echo -e "${GREEN}✓${NC} Git commit created"
echo ""
echo "============================================"
echo -e "${GREEN}✓ REGISTRY UPDATE COMPLETE${NC}"
echo "============================================"
echo ""
echo "Changes:"
echo "  • Registry updated: ${REGISTRY_FILE}"
echo "  • Changelog updated: ${CHANGELOG_FILE}"
echo "  • Git commit created"
echo ""
echo "To view:"
echo "  git log --oneline -1 -- scripts/client-registry.json"
echo "  git show HEAD:scripts/client-registry.json | jq '.clients[] | select(.company_name == \"${CLIENT_NAME}\")'"
echo ""

# Cleanup backup
rm "${REGISTRY_FILE}.backup"
