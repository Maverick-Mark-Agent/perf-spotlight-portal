# Deployment Checklist: Polling Job Fix

## ⚠️ Critical: This is an Edge Function Deployment

The changes are in `supabase/functions/poll-sender-emails/index.ts`, which is a **Supabase Edge Function**. This does NOT deploy automatically with Vercel frontend pushes.

## Pre-Deployment

- [x] Code changes committed to `fix/poll-sender-safe-delete`
- [x] Branch pushed to GitHub
- [ ] Edge function deployment command ready
- [ ] Database access for verification queries

## Deployment Steps

### 1. Deploy Edge Function to Supabase

```bash
# Navigate to project root
cd /Users/tommychavez/Maverick\ Dashboard/maverick-clean

# Deploy the edge function (requires Supabase CLI auth)
npx supabase functions deploy poll-sender-emails --project-ref <your-project-ref>

# Alternative: Deploy via Supabase Dashboard
# 1. Go to Supabase Dashboard → Edge Functions
# 2. Select "poll-sender-emails"
# 3. Click "Deploy"
# 4. Select branch: fix/poll-sender-safe-delete
# 5. Confirm deployment
```

### 2. Verify Deployment

```bash
# Check deployed function in Supabase Dashboard
# - Verify DEFAULT_BATCH_SIZE = 50 in deployed code
# - Check "Last Deployed" timestamp is recent
# - Review recent invocation logs
```

### 3. Test in Staging/Production

#### Option A: Wait for Scheduled Run
- Polling jobs run every 5 minutes (via cron)
- Monitor the next run automatically

#### Option B: Manual Trigger
```bash
# Via Supabase Dashboard
# 1. Go to Edge Functions → poll-sender-emails
# 2. Click "Invoke"
# 3. Send empty body: {}
# 4. Monitor logs in real-time

# Via curl (requires auth token)
curl -X POST \
  'https://<your-project-ref>.supabase.co/functions/v1/poll-sender-emails' \
  -H 'Authorization: Bearer <your-anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## Post-Deployment Verification

### 1. Database Checks

```sql
-- Check most recent job
SELECT 
  id,
  status,
  started_at,
  completed_at,
  workspaces_processed,
  total_workspaces,
  total_accounts_synced,
  duration_ms,
  warnings
FROM polling_job_status
ORDER BY started_at DESC
LIMIT 1;

-- Expected:
-- ✅ status = 'completed' (not 'running' or 'partial')
-- ✅ workspaces_processed = 25
-- ✅ total_workspaces = 25
-- ✅ duration_ms < 540000 (under 9 minutes)

-- Check sync progress
SELECT 
  job_id,
  status,
  workspaces_completed,
  total_workspaces,
  total_accounts,
  current_workspace,
  error_message
FROM sync_progress
ORDER BY updated_at DESC
LIMIT 1;

-- Expected:
-- ✅ status = 'completed' (not 'running')
-- ✅ workspaces_completed = 25
-- ✅ total_workspaces = 25
-- ✅ error_message IS NULL

-- Verify email accounts are synced
SELECT 
  workspace_name,
  COUNT(*) as account_count,
  MAX(last_synced_at) as last_sync
FROM email_accounts_raw
WHERE deleted_at IS NULL
GROUP BY workspace_name
ORDER BY workspace_name;

-- Expected:
-- ✅ 25 workspaces listed
-- ✅ last_sync timestamps are recent (within last 10 minutes)
-- ✅ Total accounts ~1889 (based on recent runs)
```

### 2. Dashboard Verification (QA Agent Cannot Fully Test This)

Since this is a backend function, the QA agent can only verify the **dashboard display** of the results, not the edge function execution itself.

**What QA Can Verify:**
- [ ] Navigate to Admin Dashboard → Polling Status
- [ ] Progress bar shows "25/25 workspaces (100%)"
- [ ] Status badge shows "Completed" (green)
- [ ] Recent sync timestamp is current
- [ ] No error messages displayed

**What QA Cannot Verify:**
- ❌ Edge function logs (backend only)
- ❌ Lock acquisition/release (backend only)
- ❌ Auto-chaining logic (won't trigger with batch size 50)
- ❌ Database polling_job_status records directly

### 3. Edge Function Logs Review

```bash
# View recent logs in Supabase Dashboard
# - Go to Edge Functions → poll-sender-emails → Logs
# - Look for recent invocations
# - Check for expected log messages:

# Expected logs:
✅ "🆔 Starting job <uuid> (batch_offset: 0, batch_size: 50)"
✅ "✅ Table-based sync lock acquired successfully"
✅ "📊 Batch 1 info: Processing workspaces 1-25 of 25 total"
✅ "Processing <workspace_name>..."
✅ "✅ <workspace_name>: X accounts synced"
✅ "🔄 Refreshing materialized view email_accounts_view..."
✅ "✅ Materialized view refreshed successfully in Xms"
✅ "📊 Background job completed successfully!"
✅ "🔓 Releasing lock in finally block..."
✅ "🔓 Table-based lock released successfully"

# Should NOT see:
❌ "⚠️ Another sync is already running"
❌ "🔄 Auto-chaining: triggering batch 2" (not needed with batch size 50)
❌ "❌ Failed to auto-chain next batch"
❌ "EarlyDrop" errors
❌ "Timeout" errors
```

## Testing Auto-Chaining (Optional Advanced Test)

To verify the chaining fix works correctly, temporarily reduce batch size:

### 1. Create Test Deployment

```bash
# Create a test branch
git checkout -b test/polling-chaining
git cherry-pick <commit-hash>

# Edit the edge function
# Change line 19: const DEFAULT_BATCH_SIZE = 8

# Commit and deploy
git commit -am "test: reduce batch size to test chaining"
npx supabase functions deploy poll-sender-emails --project-ref <your-project-ref>
```

### 2. Trigger and Monitor

```bash
# Invoke the function
# Watch logs in real-time

# Expected behavior:
# 1. Batch 1 processes workspaces 1-8
# 2. Batch 1 logs: "🔓 Releasing lock before auto-chaining..."
# 3. Batch 1 logs: "✅ Lock released successfully before chaining"
# 4. Batch 1 logs: "🔄 Auto-chaining: triggering batch 2"
# 5. Batch 2 starts (new invocation appears in logs)
# 6. Batch 2 logs: "🔗 Auto-chained batch 2 starting (job_id: <same-uuid>)"
# 7. Batch 2 acquires lock successfully (no "Another sync is running")
# 8. Batch 2 processes workspaces 9-16
# 9. Batch 3 and 4 continue similarly
# 10. Final batch refreshes materialized view
# 11. Job status shows: 25/25 workspaces, status='completed'
```

### 3. Restore Production Config

```bash
# After testing, restore batch size to 50
git checkout fix/poll-sender-safe-delete
npx supabase functions deploy poll-sender-emails --project-ref <your-project-ref>
```

## Rollback Plan

If issues occur:

### Immediate Rollback to Main

```bash
# Deploy the main branch version
git checkout main
npx supabase functions deploy poll-sender-emails --project-ref <your-project-ref>

# Monitor next run
# Main has DEFAULT_BATCH_SIZE = 8, so it will only process 8 workspaces
# But it won't hang (it just won't complete all 25)
```

### Alternative: Hotfix

```bash
# If partial processing is acceptable temporarily
# Keep DEFAULT_BATCH_SIZE = 50 but disable chaining:

# Edit supabase/functions/poll-sender-emails/index.ts
# Comment out lines 743-801 (auto-chaining block)

# Quick commit and deploy
git commit -am "hotfix: disable auto-chaining temporarily"
npx supabase functions deploy poll-sender-emails --project-ref <your-project-ref>
```

## Success Criteria

- [x] Code committed and pushed
- [ ] Edge function deployed to Supabase
- [ ] First run after deployment completes successfully
- [ ] Database shows 25/25 workspaces processed
- [ ] Job status = 'completed' (not 'running' or 'partial')
- [ ] No errors in edge function logs
- [ ] Dashboard shows 100% progress
- [ ] All workspaces have recent `last_synced_at` timestamps

## Merge to Main

Only after all success criteria are met:

```bash
git checkout main
git merge fix/poll-sender-safe-delete
git push origin main

# Deploy to production
npx supabase functions deploy poll-sender-emails --project-ref <your-project-ref>

# Monitor production run
# Verify same success criteria as above
```

## Notes

- **Timing**: With 25 workspaces and batch size 50, expect 2-5 minute runtime
- **Large Workspace**: "Maverick In-house" has 1600+ accounts, may take up to 3 minutes alone
- **Timeout Safety**: Function has 9-minute runtime limit, plenty of buffer
- **Future Growth**: If workspace count exceeds 50, auto-chaining will activate automatically

## Contact

If deployment fails or unexpected behavior occurs:
- Check Supabase Edge Function logs first
- Run database verification queries
- Review POLLING-FIX-SUMMARY.md for detailed problem analysis
- Rollback to main if critical

---

**Branch**: `fix/poll-sender-safe-delete`  
**Deployment Target**: Supabase Edge Functions (not Vercel)  
**Ready**: ✅ Code complete, awaiting deployment
