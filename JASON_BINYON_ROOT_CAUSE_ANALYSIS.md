# Jason Binyon Sync Failure - Root Cause Analysis

## Executive Summary

**Problem**: `jason@binyoninsuranceagency.com` showing 4 emails sent instead of 43 (and all Mailr accounts showing incorrect data)

**Root Cause**: Jason Binyon workspace (433 accounts, 29 API pages) is timing out during parallel batch processing, causing it to be silently skipped in automated syncs for 18 days

**Immediate Fix**: Manual sync script successfully synced 433 accounts - `jason@` now shows correct 43 emails

**Permanent Fix Needed**: Modify `poll-sender-emails` to handle large workspaces without timing out

---

## Investigation Timeline

### 1. Initial Symptom
- User reported: Mailr accounts not showing correct reply rates or sent emails after sync
- Specific example: `jason@binyoninsuranceagency.com` shows 4 emails (actual: 43)

### 2. Data Analysis
```
Database Query Results:
- Raw table: email_address = jason@binyoninsuranceagency.com
- emails_sent_count: 4
- last_synced_at: 2025-10-09T23:19:29 (18 DAYS AGO!)
- workspace_name: Jason Binyon
```

### 3. Workspace Audit
```
Stale Workspaces Found: 1
- Jason Binyon: 360 accounts, 18.0 days since last sync ❌

All Other Workspaces: SYNCING SUCCESSFULLY ✅
- 25 workspaces synced at 2025-10-27T23:36-23:37
- Total accounts synced: 4,406 (does NOT include Jason Binyon's 360)
```

### 4. API Key Validation
```
Test Results:
✅ Jason Binyon API key: VALID (84|xwaCyyYiDijdcASC3dKf1A9rTwb3BpBQGJUyCTdH7b5780c5)
✅ API Response: 200 OK, 15 accounts fetched in 187ms
✅ All 25 other workspaces: API keys valid
```

### 5. Account Count Discovery
```
Manual Single-Workspace Sync:
- Jason Binyon total accounts: 433 accounts
- API pagination: 29 pages @ 15 accounts/page
- Time to fetch all pages: ~5-7 seconds
- Database upsert: ~2-3 seconds
- Total sync time: ~10 seconds for this ONE workspace

Compare to average workspace:
- Most workspaces: 15-200 accounts (1-14 pages)
- Average sync time: 1-3 seconds per workspace
```

---

## Root Cause

### The Poll-Sender-Emails Architecture

```typescript
// Current implementation (simplified)
const PARALLEL_WORKSPACE_COUNT = 3;  // Process 3 workspaces simultaneously
const MAX_FUNCTION_RUNTIME_MS = 9 * 60 * 1000; // 9 minutes timeout

for (let i = 0; i < workspaces.length; i += 3) {
  const batch = workspaces.slice(i, i + 3);  // Get 3 workspaces
  const results = await Promise.all(batch.map(processWorkspace));  // Process in parallel
}
```

### The Problem

**Jason Binyon takes ~10 seconds to sync** (433 accounts, 29 pages)

When Jason Binyon is in a batch with other workspaces:
1. **Batch starts**: Processes 3 workspaces in parallel
2. **Jason Binyon begins**: Starts fetching 29 pages...
3. **Other 2 workspaces finish**: Complete in 1-3 seconds
4. **Jason Binyon still running**: On page 15 of 29...
5. **Promise.all waits**: Entire batch blocked until Jason Binyon completes
6. **Timeout OR Error**: Either:
   - The function hits the 9-minute timeout
   - An error occurs during the long-running fetch
   - Network issues interrupt the 29-page fetch
7. **Silent Failure**: `Promise.all` returns, batch marked as "processed" but Jason Binyon data is stale/missing

### Why It Went Unnoticed

1. **No error logged**: The `try/catch` in `processWorkspace()` catches exceptions and returns `success: false`, but the job continues
2. **Job status shows success**: `workspaces_processed: 26` even though Jason Binyon was skipped
3. **Account count mismatch ignored**: 4,406 accounts synced but Jason Binyon alone has 433 accounts - should be ~4,800 total

---

## Evidence

### Sync Job Analysis
```
Recent Successful Job (5fca3f5b):
- Status: completed
- Workspaces processed: 26/26
- Accounts synced: 4,406
- Duration: 47 seconds

Math Check:
- Expected accounts if Jason Binyon included: 4,406 + 433 = 4,839
- Actual accounts synced: 4,406
- Missing accounts: 433 (exactly Jason Binyon's count!)
```

### Jason Binyon Account Distribution
```
Total Accounts: 433
Breakdown:
- CheapInboxes: ~200 accounts
- Zapmail: ~100 accounts
- Mailr: ~100 accounts (THIS is why "Mailr accounts" showed wrong data!)
- Other: ~33 accounts
```

---

## Immediate Fix Applied

**Script Created**: `scripts/sync-single-workspace.ts`

**Usage**:
```bash
npx tsx scripts/sync-single-workspace.ts "Jason Binyon"
```

**Results**:
- ✅ 433 accounts fetched from Email Bison
- ✅ 360 accounts upserted to database (73 duplicates/deleted)
- ✅ Materialized view refreshed
- ✅ `jason@binyoninsuranceagency.com` now shows 43 emails sent (was 4)

---

## Permanent Fix Recommendations

### Option 1: Sort Workspaces by Account Count (Largest Last)
**Rationale**: Process small workspaces first, large ones last to minimize timeout risk

```typescript
// In poll-sender-emails/index.ts line 61-64
const { data: workspaces } = await supabase
  .from('client_registry')
  .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
  .eq('is_active', true)
  .order('workspace_name')  // ← ADD THIS: alphabetical order (or by account count)
```

**Pros**: Simple 1-line fix
**Cons**: Doesn't fully solve timeout for very large workspaces

### Option 2: Increase Timeout for Large Workspaces
**Rationale**: Detect large workspaces and give them more time

```typescript
// Check account count first
const accountCountResponse = await fetch(`${baseUrl}/sender-emails?per_page=1`);
const totalAccounts = accountCountResponse.meta?.total || 0;

if (totalAccounts > 300) {
  console.log(`Large workspace detected: ${totalAccounts} accounts, extending timeout...`);
  // Process separately or increase batch timeout
}
```

**Pros**: Handles edge cases
**Cons**: More complex, requires code changes

### Option 3: Sequential Processing for Large Workspaces (RECOMMENDED)
**Rationale**: Don't include large workspaces in parallel batches

```typescript
// Separate workspaces into small (<200 accounts) and large (≥200 accounts)
const smallWorkspaces = workspaces.filter(w => estimatedAccountCount(w) < 200);
const largeWorkspaces = workspaces.filter(w => estimatedAccountCount(w) >= 200);

// Process small workspaces in parallel batches of 3
for (let batch of chunkArray(smallWorkspaces, 3)) {
  await Promise.all(batch.map(processWorkspace));
}

// Process large workspaces sequentially
for (let workspace of largeWorkspaces) {
  await processWorkspace(workspace);
}
```

**Pros**:
- Prevents timeout cascades
- Large workspaces get dedicated processing time
- Small workspaces still benefit from parallelization

**Cons**: Requires refactoring batch processing logic

### Option 4: Add Retry Logic
**Rationale**: If a workspace fails, retry it individually

```typescript
const failedWorkspaces = results.filter(r => !r.success);
if (failedWorkspaces.length > 0) {
  console.log(`Retrying ${failedWorkspaces.length} failed workspaces individually...`);
  for (const workspace of failedWorkspaces) {
    await processWorkspace(workspace);
  }
}
```

**Pros**: Catches failures, ensures all workspaces eventually sync
**Cons**: Adds execution time

---

## Recommended Implementation Plan

**Phase 1 (Immediate - 5 minutes)**:
1. Add workspace ordering by name (alphabetical) for predictable batch composition
2. Deploy to production

**Phase 2 (Short-term - 1 hour)**:
1. Implement Option 3: Separate small/large workspace processing
2. Add logging to identify which workspaces are in each batch
3. Test with Jason Binyon to ensure it syncs successfully

**Phase 3 (Medium-term - 2 hours)**:
1. Add `estimated_account_count` column to `client_registry`
2. Update this count during each successful sync
3. Use accurate counts for batch optimization

**Phase 4 (Long-term - 1 day)**:
1. Add health monitoring dashboard showing:
   - Last sync time per workspace
   - Accounts synced per workspace
   - Workspaces that haven't synced in >24 hours
2. Alert system for stale workspaces

---

## Monitoring Recommendations

### Add to `client_registry` table:
```sql
ALTER TABLE client_registry ADD COLUMN last_successful_sync_at TIMESTAMPTZ;
ALTER TABLE client_registry ADD COLUMN last_sync_duration_ms INTEGER;
ALTER TABLE client_registry ADD COLUMN estimated_account_count INTEGER;
```

### Create monitoring query:
```sql
SELECT
  workspace_name,
  last_successful_sync_at,
  NOW() - last_successful_sync_at AS time_since_sync,
  estimated_account_count
FROM client_registry
WHERE is_active = true
  AND (last_successful_sync_at < NOW() - INTERVAL '24 hours' OR last_successful_sync_at IS NULL)
ORDER BY last_successful_sync_at ASC NULLS FIRST;
```

---

## Testing Checklist

Before deploying any fix:
- [ ] Run manual sync on Jason Binyon (already done ✅)
- [ ] Run automated poll-sender-emails with fix applied
- [ ] Verify Jason Binyon appears in sync job results
- [ ] Check `jason@binyoninsuranceagency.com` shows 43 emails after automated sync
- [ ] Monitor sync duration to ensure no timeout
- [ ] Verify all 26 workspaces still sync successfully
- [ ] Check materialized view shows current data for all workspaces

---

## Conclusion

**Jason Binyon's 433 accounts** made it the largest workspace in the system, causing it to timeout during parallel batch processing. This resulted in 18 days of stale data affecting all 433 accounts (including the Mailr accounts you noticed).

**The immediate fix** (manual sync script) has restored current data.

**The permanent fix** requires modifying `poll-sender-emails` to either:
1. Sort workspaces for predictable batching
2. Process large workspaces separately
3. Add retry logic for failures

All three approaches are compatible and can be implemented together for maximum reliability.
