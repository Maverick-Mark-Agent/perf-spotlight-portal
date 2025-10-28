# Edge Function Hang Investigation

## Problem Summary

**Status**: CRITICAL - Edge Function `poll-sender-emails` is completely non-functional
**Impact**: Automated syncs have been broken, Jason Binyon hasn't synced in 18 days
**Manual Workaround**: `sync-single-workspace.ts` script works perfectly

---

## Timeline of Discovery

### 1. Original Issue
- User reported: Mailr accounts showing incorrect data
- Example: `jason@binyoninsuranceagency.com` showing 4 emails (actual: 43)

### 2. Investigation Findings
- Jason Binyon workspace: 433 accounts, last synced 18 days ago
- All other 25 workspaces: Syncing successfully
- API keys: ALL VALID (tested with test-workspace-apis.ts)

### 3. Fix Attempts

**Attempt 1: Add Workspace Ordering**
- Added `.order('workspace_name')` to workspace query
- **Result**: Edge Function hung completely, 0 workspaces processed

**Attempt 2: Add Retry Logic**
- Added sequential retry for failed workspaces
- **Result**: Edge Function hung completely, 0 workspaces processed

**Attempt 3: Revert to Original Code**
- Removed ALL changes, restored to last known working version (commit f4baeb3)
- **Result**: Edge Function STILL hangs, 0 workspaces processed

### 4. Critical Discovery

**The Edge Function is fundamentally broken** - not just for Jason Binyon, but for ALL workspaces.

Even the code that supposedly worked before is now hanging completely.

---

## Test Results

### Edge Function Sync (FAILING ❌)
```
Job ID: 77039d02-af41-4b1b-b7ac-1937d33684a9
Started: 2025-10-28T00:19:53
Status after 90+ seconds: running
Workspaces processed: 0/26
Accounts synced: 0
Error message: null
```

**Behavior**: Function hangs indefinitely at 0 workspaces processed, no error logged

### Manual Sync (WORKING ✅)
```bash
npx tsx scripts/sync-single-workspace.ts "Jason Binyon"
```

**Results**:
- ✅ 433 accounts fetched in ~15 seconds (29 pages @ 15/page)
- ✅ Database upsert successful
- ✅ Materialized view refreshed
- ✅ jason@binyoninsuranceagency.com now shows correct 43 emails

---

## Root Cause Hypothesis

The Edge Function is hanging during **the first workspace API call to Email Bison**.

**Evidence**:
1. Manual sync (direct Node.js fetch) works perfectly
2. Edge Function hangs before processing ANY workspace (stuck at 0)
3. Job status never updates (stays at "running" indefinitely)
4. No error message logged

**Possible Causes**:
1. **Edge Function Network Timeout**: Deno Edge Runtime may have different fetch timeout behavior than Node.js
2. **Environment Variable Issue**: `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` may be missing/incorrect
3. **Deno Permissions**: Edge Function may lack network permissions to call Email Bison API
4. **API Key Format Issue**: Edge Function may be encoding API key differently than manual script
5. **Cold Start Timeout**: First workspace taking too long, hitting Edge Function initialization timeout

---

## Immediate Action Required

### Option 1: Use Scheduled Manual Syncs (RECOMMENDED)
Instead of fixing the Edge Function, run `sync-single-workspace.ts` on a schedule:

```bash
# Create cron job to sync all workspaces every 4 hours
*/4 * * * * cd /path/to/project && npx tsx scripts/sync-all-workspaces.ts
```

**Create `scripts/sync-all-workspaces.ts`**:
```typescript
// Fetch all active workspaces from client_registry
// Loop through each workspace
// Call sync-single-workspace logic for each
// Log results to sync_progress table
```

**Pros**:
- Works immediately (manual sync proven to work)
- Reliable (no Edge Function mysteries)
- Easy to monitor (script output visible)

**Cons**:
- Requires cron/scheduler setup
- Runs outside Supabase (external process)

### Option 2: Debug Edge Function Network Issues
Investigate why Edge Function can't reach Email Bison API:

1. Add extensive logging before first API call
2. Test with minimal Edge Function (just one API call)
3. Check Deno fetch vs Node.js fetch differences
4. Verify environment variables are accessible

**Pros**:
- Keeps sync logic inside Supabase
- Uses existing infrastructure

**Cons**:
- Time-consuming debugging
- May reveal Supabase platform limitation
- No guarantee of fix

---

## User's Requirement

> "I don't wanna have to deal with this again"

**The Core Issue**: Jason Binyon (433 accounts) times out in parallel batch processing

**The Permanent Solution**:
1. **Fix Edge Function hang** (Option 2 above)
2. **Then implement large-workspace handling**:
   - Detect workspaces with >300 accounts
   - Process them sequentially instead of in parallel batches
   - Or increase per-workspace timeout for large workspaces

**Current Status**:
- Step 1 (fix Edge Function) is BLOCKED - function won't run at all
- Step 2 (large-workspace handling) can't be implemented until Step 1 works

---

## Manual Sync Solution (WORKING NOW)

**Current Workaround**:
```bash
# Sync Jason Binyon manually
VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." \
  npx tsx scripts/sync-single-workspace.ts "Jason Binyon"
```

**To sync all workspaces**:
```bash
# Get list of all active workspaces
workspaces=("Jason Binyon" "Kim Wallace" "Tony Schmitz" ...)

# Loop through and sync each
for workspace in "${workspaces[@]}"; do
  echo "Syncing $workspace..."
  npx tsx scripts/sync-single-workspace.ts "$workspace"
done
```

---

## Next Steps

### Immediate (Today)
1. **Create sync-all-workspaces.ts** script to loop through all 26 workspaces
2. **Run it manually** to get all workspaces up to date
3. **Verify Jason Binyon** data is current in dashboard

### Short-term (This Week)
1. **Set up cron job** to run sync-all-workspaces.ts every 4 hours
2. **Monitor sync logs** to ensure all workspaces sync successfully
3. **Alert if any workspace fails** to sync

### Long-term (Next Sprint)
1. **Debug Edge Function hang** with minimal test case
2. **File support ticket** with Supabase if platform limitation
3. **Consider migrating** sync logic to external service if Edge Functions unreliable

---

## Lessons Learned

1. **Edge Functions != Node.js**: Different runtime, different behavior
2. **Manual scripts are valuable**: Bypassed entire Edge Function mystery
3. **Timeouts cascade**: One slow workspace (Jason Binyon) doesn't explain complete hang
4. **Network issues are silent**: No error logged, function just hangs forever
5. **Two-pronged approach**: Fix immediate issue (manual sync), then investigate root cause

---

## Status as of 2025-10-28 00:22 UTC

**Edge Function**: ❌ BROKEN (hangs indefinitely at 0 workspaces processed)
**Manual Sync**: ✅ WORKING (Jason Binyon synced successfully, 433 accounts)
**Data Current**: ✅ YES (jason@binyoninsuranceagency.com now shows 43 emails)
**Automated Sync**: ❌ NOT WORKING (requires fix or alternative solution)

**Recommended Next Action**: Create `sync-all-workspaces.ts` and run it manually to get all 26 workspaces current
