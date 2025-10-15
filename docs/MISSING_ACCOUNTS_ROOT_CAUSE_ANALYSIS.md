# Missing Email Accounts - Root Cause Analysis & Fix Plan

**Date**: October 13, 2025
**Issue**: Dashboard showing 1,952-2,109 accounts instead of expected 4,000+
**Status**: 🔍 Root Cause Identified

---

## 🔍 Investigation Results

### Current State
- **Database has**: 2,109 accounts
- **Expected**: 4,000+ accounts
- **Missing**: ~2,000 accounts (50% of data)
- **Active workspaces**: 26 total
- **Syncing workspaces**: 14 (54%)
- **NOT syncing**: 12 workspaces (46%)

### Missing Workspaces (12 total)
All are Maverick instance workspaces:
1. Jeff Schroder (workspace ID: 26)
2. John Roberts (workspace ID: 28)
3. **Kim Wallace** (workspace ID: 4) ⭐ You mentioned this one specifically
4. Kirk Hodgson (workspace ID: 23)
5. Maverick In-house (workspace ID: 14)
6. Nick Sakha (workspace ID: 40)
7. Rob Russell (workspace ID: 24)
8. SMA Insurance (workspace ID: 32)
9. StreetSmart Commercial (workspace ID: 29)
10. StreetSmart P&C (workspace ID: 22)
11. StreetSmart Trucking (workspace ID: 9)
12. Tony Schmitz (workspace ID: 41)

**Key Observation**: ALL missing workspaces have:
- ✅ `bison_workspace_id` configured
- ✅ `bison_api_key` set
- ✅ `is_active = true`
- ❌ Zero accounts in `sender_emails_cache`

---

## 🎯 Root Cause Hypothesis

Based on the evidence, the most likely causes are:

### Theory #1: Workspace Switching API Call Failing (90% confidence)
**Evidence**:
- All missing workspaces are in Maverick instance
- Polling function uses workspace-specific API keys
- Code at `poll-sender-emails/index.ts:72-85` only switches workspace if NOT using workspace-specific key
- But the API call may still be failing silently

**Why this matters**:
```typescript
// Current code (line 66-85)
const isWorkspaceSpecificKey = !!workspace.bison_api_key

if (!isWorkspaceSpecificKey) {
  // Switch workspace using global key
  await switchWorkspace(workspace.bison_workspace_id)
} else {
  // Skip switching - assume API key is already scoped
  // BUT: What if the API key is invalid or expired?
}
```

**Problem**: If a workspace-specific API key is:
- Invalid
- Expired
- Incorrectly scoped
- Missing permissions

The code will NOT attempt workspace switching, and will silently fail to fetch accounts.

### Theory #2: API Rate Limiting (60% confidence)
**Evidence**:
- Polling job processes workspaces sequentially (now in batches of 3)
- 100ms delay between batches
- Some workspaces may be rate-limited by Email Bison API

**Why this matters**:
- If rate limit is hit, subsequent API calls return empty results
- Code doesn't distinguish between "no accounts" and "rate limited"

### Theory #3: Parallel Processing Race Condition (40% confidence)
**Evidence**:
- We just added parallel processing (3 workspaces at once)
- Multiple concurrent API calls to same Email Bison instance
- Possible workspace context collision

**Why this matters**:
```typescript
// Processing 3 workspaces in parallel
await Promise.all([
  processWorkspace(workspace1), // workspace_id: 4
  processWorkspace(workspace2), // workspace_id: 9
  processWorkspace(workspace3), // workspace_id: 14
]);
```

If all 3 are using workspace-specific keys to the SAME Bison instance, there could be context switching issues.

### Theory #4: Database Unique Constraint Issues (20% confidence)
**Evidence**:
- Table has unique constraint: `email_address + workspace_name`
- Possible that some accounts exist in multiple workspaces

**Why this matters**:
- If account `john@example.com` exists in 2 workspaces, only one gets stored
- Other upserts silently fail

---

## 🔬 Diagnostic Steps

### Step 1: Check Workspace API Key Validity
```typescript
// Test each missing workspace's API key
for (const workspace of missingWorkspaces) {
  const response = await fetch(`${baseUrl}/sender-emails?per_page=1`, {
    headers: { 'Authorization': `Bearer ${workspace.bison_api_key}` }
  });

  console.log(`${workspace.name}: ${response.status}`);
  // Expected: 200 = Valid, 401 = Invalid, 403 = No permissions
}
```

### Step 2: Test Manual Fetch for One Missing Workspace
```typescript
// Try fetching Kim Wallace accounts directly
const kimWallaceApiKey = '...'; // From client_registry
const response = await fetch(
  'https://send.maverickmarketingllc.com/api/sender-emails?per_page=100',
  { headers: { 'Authorization': `Bearer ${kimWallaceApiKey}` } }
);

console.log('Kim Wallace accounts:', await response.json());
```

### Step 3: Check for Silent Errors in Polling Job
**Current Problem**: Errors in `processWorkspace()` are caught but not logged properly

```typescript
// poll-sender-emails/index.ts:224-232
} catch (error) {
  console.error(`❌ Failed to sync ${workspace.workspace_name}:`, error)
  return {
    workspace: workspace.workspace_name,
    error: error.message,  // ⚠️ Only logs to console, not visible
    success: false
  }
}
```

### Step 4: Check Database Constraints
```sql
-- Check for duplicate email addresses across workspaces
SELECT
  email_address,
  COUNT(*) as workspace_count,
  STRING_AGG(workspace_name, ', ') as workspaces
FROM sender_emails_cache
GROUP BY email_address
HAVING COUNT(*) > 1
LIMIT 10;
```

---

## 🛠️ Fix Plan

### Phase 1: Enhanced Logging & Diagnostics (30 mins)

**File**: `poll-sender-emails/index.ts`

1. **Add detailed error logging**:
```typescript
// At line 70, add:
console.log(`🔍 Processing ${workspace.workspace_name}:`, {
  instance: workspace.bison_instance,
  workspaceId: workspace.bison_workspace_id,
  hasApiKey: !!workspace.bison_api_key,
  apiKeyPreview: workspace.bison_api_key?.substring(0, 10) + '...'
});
```

2. **Log API response status**:
```typescript
// After line 99 (API call):
console.log(`📡 API Response for ${workspace.workspace_name}:`, {
  status: response.status,
  statusText: response.statusText,
  ok: response.ok
});

if (!response.ok) {
  const errorText = await response.text();
  console.error(`❌ API Error for ${workspace.workspace_name}:`, errorText);
  throw new Error(`API returned ${response.status}: ${errorText}`);
}
```

3. **Store errors in database**:
```typescript
// In catch block (line 224):
} catch (error) {
  const errorDetails = {
    workspace: workspace.workspace_name,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  // Store in polling_job_status or new error_log table
  await supabase.from('polling_errors').insert(errorDetails);

  console.error(`❌ Failed to sync ${workspace.workspace_name}:`, errorDetails);
}
```

### Phase 2: API Key Validation (20 mins)

**File**: `poll-sender-emails/index.ts`

Add API key validation BEFORE attempting to fetch:

```typescript
// New function at top of file
async function validateApiKey(apiKey: string, baseUrl: string, workspaceName: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/sender-emails?per_page=1`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!response.ok) {
      console.error(`❌ API key validation failed for ${workspaceName}: ${response.status}`);
      return false;
    }

    console.log(`✅ API key valid for ${workspaceName}`);
    return true;
  } catch (error) {
    console.error(`❌ API key validation error for ${workspaceName}:`, error);
    return false;
  }
}

// In processWorkspace (line 70):
const apiKey = workspace.bison_api_key || (
  workspace.bison_instance === 'Long Run' ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY
);

// Validate before proceeding
const isValid = await validateApiKey(apiKey, baseUrl, workspace.workspace_name);
if (!isValid) {
  throw new Error(`Invalid API key for ${workspace.workspace_name}`);
}
```

### Phase 3: Fallback to Workspace Switching (30 mins)

**Problem**: Current code assumes workspace-specific API keys work without switching.

**Solution**: Always try workspace switching as fallback:

```typescript
// Modified logic (line 71-85):
let accountsFetched = 0;
let fetchError: Error | null = null;

// Strategy 1: Try with workspace-specific API key (if available)
if (workspace.bison_api_key) {
  console.log(`Strategy 1: Using workspace-specific API key for ${workspace.workspace_name}`);
  try {
    accountsFetched = await fetchAccountsWithKey(workspace.bison_api_key, baseUrl);
  } catch (error) {
    fetchError = error;
    console.warn(`⚠️  Strategy 1 failed, trying Strategy 2...`);
  }
}

// Strategy 2: Fallback to workspace switching with global key
if (accountsFetched === 0 && !workspace.bison_api_key) {
  console.log(`Strategy 2: Switching workspace for ${workspace.workspace_name}`);
  try {
    await switchWorkspace(workspace.bison_workspace_id, apiKey);
    accountsFetched = await fetchAccountsWithKey(apiKey, baseUrl);
  } catch (error) {
    throw new Error(`Both strategies failed: ${fetchError?.message || error.message}`);
  }
}
```

### Phase 4: Add Retry Logic for Failed Workspaces (20 mins)

**Problem**: If a workspace fails once, it's skipped completely.

**Solution**: Retry failed workspaces at the end:

```typescript
// After main processing loop (line 264):
if (results.some(r => !r.success)) {
  console.log('\n🔄 Retrying failed workspaces...');

  const failedWorkspaces = results
    .filter(r => !r.success)
    .map(r => workspaces.find(w => w.workspace_name === r.workspace));

  for (const workspace of failedWorkspaces) {
    try {
      console.log(`Retry: ${workspace.workspace_name}`);
      const result = await processWorkspace(workspace);

      // Update result
      const index = results.findIndex(r => r.workspace === workspace.workspace_name);
      results[index] = result;

      if (result.success) {
        totalAccountsSynced += result.accounts_synced;
      }
    } catch (error) {
      console.error(`Retry failed for ${workspace.workspace_name}:`, error);
    }
  }
}
```

### Phase 5: Manual Test & Verification (30 mins)

1. **Test one missing workspace manually**:
```bash
# Trigger sync for just Kim Wallace
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails"
```

2. **Check logs for errors**:
```bash
# View logs in Supabase dashboard
# Look for Kim Wallace specifically
```

3. **Verify accounts in database**:
```sql
SELECT workspace_name, COUNT(*)
FROM sender_emails_cache
WHERE workspace_name = 'Kim Wallace'
GROUP BY workspace_name;
```

---

## 📊 Expected Outcomes

### After Phase 1-2 (Logging & Validation)
- ✅ Know exactly WHY 12 workspaces are failing
- ✅ See specific API errors in logs
- ✅ Identify invalid/expired API keys

### After Phase 3 (Fallback Strategy)
- ✅ Workspaces with invalid keys fall back to workspace switching
- ✅ Higher success rate for account fetching

### After Phase 4 (Retry Logic)
- ✅ Transient errors are retried automatically
- ✅ Network issues don't cause permanent failures

### After Phase 5 (Testing)
- ✅ All 26 workspaces syncing successfully
- ✅ ~4,000+ accounts in database
- ✅ Dashboard showing complete data

---

## ⚠️ Quick Wins (Do These First)

### 1. Test Kim Wallace API Key Manually (5 mins)
```bash
# Get API key from database
# Then test:
curl -H "Authorization: Bearer <KIM_WALLACE_API_KEY>" \
  "https://send.maverickmarketingllc.com/api/sender-emails?per_page=10"

# Expected: 200 with account data
# If 401/403: API key is invalid → need to regenerate
```

### 2. Check Polling Job Logs (5 mins)
- Go to Supabase Dashboard → Edge Functions → poll-sender-emails → Logs
- Look for error messages related to the 12 missing workspaces
- Take screenshots and share

### 3. Run Manual Sync & Watch Logs (10 mins)
```bash
# Trigger sync
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails" \
  -H "Authorization: Bearer <ANON_KEY>"

# Watch logs in real-time
# Look for which workspaces succeed vs fail
```

---

## 🎯 Next Steps

**Immediate** (Do Now):
1. Run Kim Wallace API key test (5 mins)
2. Check Supabase function logs (5 mins)
3. Share findings

**Short-term** (Today):
1. Implement Phase 1 (Enhanced logging)
2. Implement Phase 2 (API key validation)
3. Deploy and test

**Medium-term** (This week):
1. Implement Phase 3 (Fallback strategy)
2. Implement Phase 4 (Retry logic)
3. Verify all 4,000+ accounts are syncing

---

## 📚 Files to Modify

1. **`supabase/functions/poll-sender-emails/index.ts`**
   - Add logging (lines 70-100)
   - Add API key validation (new function)
   - Add fallback strategy (lines 71-85)
   - Add retry logic (after line 264)

2. **`supabase/migrations/20251013100000_create_polling_errors_table.sql`** (new)
   - Store detailed error logs for debugging

3. **`scripts/test-workspace-api-keys.ts`** (new)
   - Test all 26 workspace API keys
   - Report which are valid/invalid

---

## 🤔 Questions to Answer

1. **Do the missing workspaces actually have email accounts in Email Bison?**
   - Test Kim Wallace manually to confirm

2. **Are the API keys valid?**
   - Test with curl or Postman

3. **Is the polling job logging errors that we're not seeing?**
   - Check Supabase function logs

4. **Are there database constraint violations?**
   - Run duplicate email query

---

**Ready to implement fixes? Let me know which phase to start with!**
