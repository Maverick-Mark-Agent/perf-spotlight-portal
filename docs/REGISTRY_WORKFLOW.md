# Client Registry Workflow

This document explains how to manage and track changes to the client registry using git-based workflows.

## Overview

The client registry (`scripts/client-registry.json`) is tracked in git, providing an automatic audit trail of all changes. Every update should be committed with a descriptive message.

## Registry Files

- **`scripts/client-registry.json`** - The master registry of all clients
- **`docs/REGISTRY_CHANGELOG.md`** - Human-readable changelog of all updates
- **Git history** - Complete audit trail via version control

## Making Changes

### Method 1: Using the Helper Script (Recommended)

For single-field updates, use the helper script:

```bash
./scripts/commit-registry-change.sh "Client Name" "field" "old_value" "new_value" "reason"
```

**Example:**
```bash
./scripts/commit-registry-change.sh "John Roberts" "webhook_id" "78" "79" "Webhook recreated after JWT fix"
```

**What it does:**
1. Updates the registry JSON
2. Updates the changelog
3. Creates a git commit with descriptive message
4. Backs up before changes (safety net)

### Method 2: Manual Updates

For complex changes (multiple fields, bulk updates), edit manually:

1. **Edit the registry:**
   ```bash
   vi scripts/client-registry.json
   # Make your changes using jq or text editor
   ```

2. **Update changelog:**
   ```bash
   echo "2025-10-06 14:30 | Client Name | field: old → new | Reason" >> docs/REGISTRY_CHANGELOG.md
   ```

3. **Commit with descriptive message:**
   ```bash
   git add scripts/client-registry.json docs/REGISTRY_CHANGELOG.md
   git commit -m "update: [description of changes]

   Details:
   - Change 1
   - Change 2
   - Reason for changes"
   ```

## Viewing History

### See all registry changes
```bash
git log --oneline -- scripts/client-registry.json
```

### See what changed in last commit
```bash
git show HEAD:scripts/client-registry.json | jq '.clients[] | select(.company_name == "John Roberts")'
```

### Compare current vs previous
```bash
git diff HEAD~1 scripts/client-registry.json
```

### See full changelog
```bash
cat docs/REGISTRY_CHANGELOG.md
```

### Find when a specific change was made
```bash
git log -p --all -S "webhook_id" -- scripts/client-registry.json
```

## Best Practices

### 1. Commit Frequently
Commit each logical change separately, don't batch multiple unrelated changes.

**Good:**
```bash
git commit -m "update: Kim Wallace webhook_id 92 → 93"
git commit -m "update: Rick Huemmer webhook_id null → 94"
```

**Bad:**
```bash
git commit -m "update: various webhook fixes"  # Too vague
```

### 2. Write Descriptive Commit Messages
Follow this format:
```
update: [Client] [field] [old] → [new]

[Reason or context for the change]

[Optional: Related issue, ticket, or PR]
```

**Example:**
```
update: John Roberts webhook_id 78 → 79

Webhook was recreated after JWT verification fix.
Original webhook (78) was deleted during troubleshooting.

Related: WEBHOOK_STATUS.md - JWT verification issue
```

### 3. Use the Helper Script for Single Changes
The helper script ensures:
- Consistent commit message format
- Automatic changelog updates
- Backup before changes
- Timestamp updates

### 4. Always Update the Changelog
Whether using the helper script or manual updates, always update `docs/REGISTRY_CHANGELOG.md` so there's a human-readable summary.

### 5. Verify Before Committing
```bash
# Check what you're about to commit
git diff scripts/client-registry.json

# Validate JSON syntax
jq '.' scripts/client-registry.json > /dev/null && echo "✓ Valid JSON"
```

## Common Scenarios

### Scenario 1: Update Single Webhook ID
```bash
./scripts/commit-registry-change.sh "John Roberts" "webhook_id" "78" "79" "Webhook recreated"
```

### Scenario 2: Bulk Update After Audit
```bash
# After running audit-all-workspaces.sh and fix-webhooks.sh
vi scripts/client-registry.json  # Update multiple webhook IDs

# Document in changelog
echo "2025-10-06 15:00 | Bulk Update | webhook_ids for 5 clients | Post-audit remediation" >> docs/REGISTRY_CHANGELOG.md

# Commit with details
git add scripts/client-registry.json docs/REGISTRY_CHANGELOG.md
git commit -m "update: bulk webhook ID corrections after workspace audit

Fixed webhook IDs for:
- Kim Wallace: 92 → 93
- Rick Huemmer: null → 94
- StreetSmart P&C: 85 → 82
- StreetSmart Commercial: 84 → 83
- StreetSmart Trucking: 90 → 84

All verified via Email Bison API workspace checks.
See: docs/WEBHOOK_STATUS.md for full details."
```

### Scenario 3: Add New Client
```bash
# Manually edit registry to add new client
vi scripts/client-registry.json

# Update changelog
echo "2025-10-06 16:00 | New Client: Example Corp | Added to registry | Workspace ID 50, Webhook 95" >> docs/REGISTRY_CHANGELOG.md

# Commit
git add scripts/client-registry.json docs/REGISTRY_CHANGELOG.md
git commit -m "add: Example Corp to client registry

Workspace ID: 50
Webhook ID: 95
Status: deployed

Onboarded via standard setup process."
```

### Scenario 4: Rollback a Change
```bash
# View recent changes
git log --oneline -5 -- scripts/client-registry.json

# Revert specific commit
git revert <commit-hash>

# Or restore to previous version
git checkout HEAD~1 -- scripts/client-registry.json
git commit -m "rollback: revert webhook_id change for John Roberts

Reason: incorrect webhook ID, reverting to confirmed working ID"
```

## Integration with Scripts

### Audit Scripts Should Update Registry
Scripts like `fix-webhooks.sh` create webhooks but don't update registry. After running:

```bash
# Run audit and fixes
./scripts/audit-all-workspaces.sh
./scripts/fix-webhooks.sh scripts/audit-report-*.json

# Manually update registry based on fix report
# Then commit
git add scripts/client-registry.json docs/REGISTRY_CHANGELOG.md
git commit -m "update: registry with webhook IDs from fix-webhooks run

Applied changes from webhook-fix-report-20251006.json"
```

### Future Enhancement
Scripts could be enhanced to automatically call `commit-registry-change.sh` after making changes.

## Troubleshooting

### "Client not found" Error
The helper script searches by `company_name` or `workspace_name`. Check registry:
```bash
jq '.clients[] | {id, company_name, workspace_name}' scripts/client-registry.json | grep -i "john"
```

### Merge Conflicts
If multiple people edit registry:
```bash
git pull  # May show conflict
# Manually resolve in scripts/client-registry.json
jq '.' scripts/client-registry.json  # Verify valid JSON
git add scripts/client-registry.json
git commit
```

### Lost Changes
All changes are in git:
```bash
# View all versions
git log -p -- scripts/client-registry.json

# Restore specific version
git show <commit-hash>:scripts/client-registry.json > scripts/client-registry.json
```

## Summary

**Simple workflow:**
1. Use helper script for single changes: `./scripts/commit-registry-change.sh`
2. Manually edit for complex changes
3. Always update changelog
4. Always commit with descriptive message
5. Use git history to track all changes

**Benefits:**
- Complete audit trail
- Easy rollback
- Clear change history
- No extra tooling needed
- Integrates with existing git workflow
