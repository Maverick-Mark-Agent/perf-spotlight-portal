# Polling Job Batch Fix - Summary

## Problem Identified

The `poll-sender-emails` edge function on **main** was stuck processing only 8 of 25 workspaces (32%) per run due to a broken auto-chaining mechanism.

### Root Cause: Lock Contention Race Condition

When batch 1 completed, it attempted to chain to batch 2, but the lock was released in the `finally` block **AFTER** the chain call. This caused:

1. Batch 1 finishes processing 8 workspaces
2. Batch 1 calls `supabase.functions.invoke('poll-sender-emails', {...})` to trigger batch 2
3. Batch 2 starts and tries to acquire lock via `try_sync_lock()`
4. **Lock is still held by batch 1** (finally block hasn't executed yet)
5. Batch 2 sees "Another sync is already running" and exits gracefully
6. Batch 1's finally block releases the lock (too late)
7. Job remains in `status: 'running'` forever until watchdog cleanup (15 min timeout)

### Evidence from Database Query

```
Recent polling jobs (on main):
  - Status: completed (but actually partial)
  - Workspaces: 8/25 (32%)
  - All jobs stuck at batch 1

Recent sync progress:
  - Status: running (stuck forever)
  - Progress: 8/25 workspaces  
  - Current: "Batch 1 complete, chaining to next..." (never happens)
  - Eventually marked as failed by watchdog after 15 minutes
```

## Solution Implemented: Hybrid Approach (Option D)

### 1. Increased Batch Size (Already on Branch)
- Changed `DEFAULT_BATCH_SIZE` from 8 to **50**
- This handles all 25 current workspaces in a single invocation
- No chaining needed for current workload
- Comment updated: "Process all workspaces in a single invocation (chaining is unreliable)"

### 2. Fixed Auto-Chaining Logic (Future-Proofing)
Even though batching won't trigger now, fixed the chaining for future growth:

**Key Changes:**
- **Release lock BEFORE the chain call** (lines 753-771)
- Set `usingTableLock = false` to prevent double-release in finally block
- Added fallback to await chain call if `EdgeRuntime.waitUntil` unavailable
- Updated finally block to handle already-released locks gracefully

**Code Flow (Fixed):**
```typescript
1. Process batch 1 (8 workspaces)
2. Check hasMoreBatches → true
3. ✅ Release lock BEFORE chaining (NEW)
4. Call supabase.functions.invoke('poll-sender-emails', { batch_offset: 8, ... })
5. Batch 2 acquires lock successfully (it's now available)
6. Finally block checks usingTableLock (now false) → skips double-release
```

### 3. Kept Soft-Delete Fix
This branch also includes the safer soft-delete approach:
- Track fetched account IDs during pagination
- Only mark as deleted AFTER successful pagination completes
- Prevents data loss if function times out mid-sync

## Files Modified

1. **supabase/functions/poll-sender-emails/index.ts**
   - Line 19: `DEFAULT_BATCH_SIZE = 50` (already on branch)
   - Lines 743-801: Fixed auto-chaining with early lock release
   - Lines 867-891: Updated finally block to handle early release

## Testing Plan

### Automatic Testing (Via Dashboard QA Agent)
The polling job is a backend edge function, so visual verification via dashboard is limited. However, we can verify:

1. **Dashboard Progress Display**
   - Navigate to Admin Dashboard → Polling Status
   - Verify the progress bar shows "25/25 workspaces (100%)" after sync
   - Check that status is "completed" not "running" or "partial"

2. **Data Freshness**
   - Check that email accounts table shows recent `last_synced_at` timestamps
   - Verify all 25 workspaces have recent data

### Manual Testing Required (Backend)

Since this is an edge function, these tests require Supabase deployment:

1. **Test Normal Operation (No Chaining)**
   ```bash
   # Trigger the function via Supabase dashboard or CLI
   # Expected: Processes all 25 workspaces in one run
   # Check: polling_job_status table shows 25/25 workspaces
   ```

2. **Test Auto-Chaining (Simulate Large Workload)**
   ```bash
   # Temporarily set DEFAULT_BATCH_SIZE = 8 in deployed function
   # Trigger the function
   # Expected: Batch 1 processes 8, chains to batch 2 successfully
   # Expected: Batch 2 processes next 8, chains to batch 3
   # Expected: Final batch completes and marks job as done
   # Check: All 25 workspaces processed, status = 'completed'
   ```

3. **Verify Database State**
   ```sql
   -- Check recent job status
   SELECT * FROM polling_job_status 
   ORDER BY started_at DESC LIMIT 5;
   
   -- Should show:
   -- - status: 'completed' (not 'running' or 'partial')
   -- - workspaces_processed: 25
   -- - total_workspaces: 25
   
   -- Check sync progress
   SELECT * FROM sync_progress 
   ORDER BY updated_at DESC LIMIT 3;
   
   -- Should show:
   -- - status: 'completed' (not 'running')
   -- - workspaces_completed: 25
   ```

## Deployment Steps

### ⚠️ Critical: Edge Function Must Be Deployed to Supabase

This fix is in an **Edge Function**, not frontend code. Deployment process:

1. **Commit and Push to Branch**
   ```bash
   git add supabase/functions/poll-sender-emails/index.ts
   git commit -m "fix: resolve polling job batch chaining lock contention"
   git push origin fix/poll-sender-safe-delete
   ```

2. **Deploy to Supabase (Required)**
   ```bash
   # Option A: Deploy via Supabase CLI
   npx supabase functions deploy poll-sender-emails
   
   # Option B: Deploy via Supabase Dashboard
   # - Go to Edge Functions in Supabase dashboard
   # - Select poll-sender-emails
   # - Deploy from GitHub branch: fix/poll-sender-safe-delete
   ```

3. **Verify Deployment**
   - Check Supabase dashboard → Edge Functions → poll-sender-emails
   - Verify the deployed version shows updated code (check DEFAULT_BATCH_SIZE = 50)
   - Check recent invocation logs for new batch logic

4. **Test in Production**
   - Wait for next scheduled poll (or trigger manually)
   - Monitor `polling_job_status` table for completion
   - Verify all 25 workspaces are processed

5. **Merge to Main (After Testing)**
   ```bash
   git checkout main
   git merge fix/poll-sender-safe-delete
   git push origin main
   
   # Deploy main to production
   npx supabase functions deploy poll-sender-emails
   ```

## Performance Expectations

### With Current Fix (Batch Size = 50)
- **Single invocation** processes all 25 workspaces
- **Estimated runtime**: ~2-5 minutes (most workspaces are small)
  - Small workspaces: 5-10 seconds each
  - "Maverick In-house" (1600+ accounts): up to 3 minutes
  - Total: well under 9-minute timeout
- **No chaining needed** for current workload

### If Chaining is Triggered (Future Growth)
- **Batch size**: 50 workspaces per batch
- **Lock released early**: Next batch starts immediately
- **Timeout safety**: Each batch completes within 9-minute limit
- **Progress tracking**: Continuous updates across batches

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**
   ```bash
   git checkout main
   git revert <commit-hash>
   git push origin main
   npx supabase functions deploy poll-sender-emails
   ```

2. **Alternative: Increase Batch Size Further**
   - If timing is still an issue, increase `DEFAULT_BATCH_SIZE` to 100
   - This allows for up to 2x workspace growth without chaining

3. **Nuclear Option: Disable Auto-Chaining**
   - Comment out the entire `if (hasMoreBatches)` block
   - Function will process first batch only, but won't hang
   - Requires manual re-triggering for full sync

## Related Changes on This Branch

This branch (`fix/poll-sender-safe-delete`) also includes:

1. **Soft-Delete Fix** (lines 445-498)
   - Safer deletion strategy that prevents data loss
   - Only marks accounts as deleted AFTER successful pagination
   - Both fixes are compatible and should be deployed together

## Next Steps

1. ✅ **Code changes complete**
2. ⏳ **Deploy to Supabase** (required - edge function deployment)
3. ⏳ **Monitor first run** after deployment
4. ⏳ **Verify database shows 25/25 workspaces**
5. ⏳ **Merge to main** after successful testing
6. ⏳ **Document in changelog**

## Questions to Answer During Testing

- [ ] Does the function complete all 25 workspaces in one run?
- [ ] Is the job status marked as "completed" (not "running")?
- [ ] Are all workspaces showing recent `last_synced_at` timestamps?
- [ ] Does the dashboard progress bar show 100%?
- [ ] If we reduce batch size to 8 for testing, does chaining work?
- [ ] Are there any errors in Supabase edge function logs?

---

**Branch**: `fix/poll-sender-safe-delete`  
**Ready for**: Supabase Edge Function deployment  
**Status**: Code complete, awaiting deployment testing
