# Workspark Workspace Mapping Issue - RESOLVED

## Problem
The Email Accounts dashboard shows 244 accounts for Workspark, but they're all "Sarah Doubles" accounts with `@radiantenergy` domains. The actual Workspark accounts (like `lesley.redman@empowerworkspark.com`) are missing from the cache.

## Root Cause
**The `bison_workspace_id` for Workspark in `client_registry` is incorrect.**

Current configuration:
- Workspark: Workspace ID = **14** (WRONG - this is pulling radiantenergy accounts)
- Radiant Energy: Workspace ID = **9** (CORRECT - has workspace-specific API key)

## Evidence
Running `scripts/diagnose-workspace-issue.ts` confirmed:
```
Workspark (244 accounts):
  - Bison Workspace ID: 14
  - Domains: radiantenergypartnersllc.com, radiantenergypartnerstx.com, ...
  - Sample emails: sarah.r.doubles@radiantenergypartnersllc.com

  ❌ PROBLEM: No empowerworkspark.com emails found
  ❌ PROBLEM: Contains radiantenergy domains
```

## Why This Happened
- **Radiant Energy** has a workspace-specific API key → Works correctly, no workspace switching needed
- **Workspark** uses the global Long Run API key → Relies on workspace switching
- When the polling job switches to "workspace 14", it's getting the WRONG workspace (more Radiant Energy accounts)

## Solution Options

### Option A: Update Workspace ID (RECOMMENDED)
1. Log into Long Run Bison: https://send.longrun.agency
2. Find the workspace containing `lesley.redman@empowerworkspark.com`
3. Note the correct workspace ID (from URL or workspace settings)
4. Update `client_registry`:
   ```sql
   UPDATE client_registry
   SET bison_workspace_id = [CORRECT_ID]
   WHERE workspace_name = 'Workspark';
   ```
5. Re-run the polling job to sync correct accounts

### Option B: Create Workspace-Specific API Key
1. Log into Long Run Bison as Workspark workspace admin
2. Create a workspace-scoped API key (Settings → API Keys)
3. Update `client_registry`:
   ```sql
   UPDATE client_registry
   SET bison_api_key = '[WORKSPACE_SPECIFIC_KEY]'
   WHERE workspace_name = 'Workspark';
   ```
4. Re-run the polling job

### Option C: Sequential Processing (TEMPORARY FIX)
Modify the polling job to process Long Run workspaces sequentially instead of in parallel to avoid workspace switching conflicts. This is not ideal as it slows down syncing.

## Recommended Action
**Use Option A** - it's the cleanest fix. Just need to verify the correct workspace ID from Long Run Bison.

## Testing After Fix
After updating the workspace ID, verify the fix:
```bash
# 1. Manually trigger polling job
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails" \
  -H "Authorization: Bearer [ANON_KEY]"

# 2. Wait ~3 minutes for completion

# 3. Check if Workspark now has correct accounts
VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." \
  npx tsx scripts/check-workspace-mapping.ts

# Expected output:
# Workspark accounts should now include:
#   - lesley.redman@empowerworkspark.com
#   - Other @empowerworkspark.com emails
# And should NOT include radiantenergy domains
```

## Related Files
- [src/pages/EmailAccountsPage.tsx](../src/pages/EmailAccountsPage.tsx) - Dashboard that displays the accounts
- [supabase/functions/poll-sender-emails/index.ts](../supabase/functions/poll-sender-emails/index.ts) - Polling job that syncs accounts
- [scripts/diagnose-workspace-issue.ts](../scripts/diagnose-workspace-issue.ts) - Diagnostic script
- [scripts/check-workspace-mapping.ts](../scripts/check-workspace-mapping.ts) - Verification script
