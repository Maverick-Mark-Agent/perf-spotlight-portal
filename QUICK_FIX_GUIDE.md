# Email Accounts Dashboard - Quick Fix Guide

## 🚀 5-Minute Fix

If users report **wrong email account totals**, follow these steps in order:

---

## Step 1: User-Side Quick Fix (30 seconds)

### Option A: Manual Refresh
1. Open email accounts dashboard
2. Click **"Manual Refresh"** button (top right)
3. Wait 2-3 seconds
4. Check if totals updated

### Option B: Hard Browser Reload
1. **Mac:** Press `Cmd + Shift + R`
2. **Windows:** Press `Ctrl + Shift + R`
3. Wait for page to reload
4. Check if totals updated

✅ **If this fixes it:** Problem was stale cache
❌ **If still wrong:** Continue to Step 2

---

## Step 2: Check Console Logs (1 minute)

1. Open browser DevTools: `F12` or `Right-click → Inspect`
2. Go to **Console** tab
3. Look for these messages:

### ✅ Good Signs:
```
✅ Fetched 4111 unique accounts in 1234ms
📊 Dashboard Stats Calculated: { totalAccounts: 4111, ... }
```

### ❌ Bad Signs:
```
❌ Database error: ...
⚠️ Data is 25.3 hours old
[Infrastructure] Fetch failed: ...
```

If you see errors → Continue to Step 3

---

## Step 3: Check Data Freshness (30 seconds)

Look at **"Last Updated"** timestamp on dashboard:

| Color | Age | Status | Action |
|-------|-----|--------|--------|
| 🟢 Green | < 6 hours | Fresh | ✅ Data is good |
| 🟡 Yellow | 6-24 hours | Stale | ⚠️ Manual refresh |
| 🔴 Red | > 24 hours | Very stale | ❌ Check polling job |

If **Red (> 24h)** → Check polling job status (Step 4)

---

## Step 4: Verify Polling Job (2 minutes)

The nightly sync job should run at midnight. Check if it succeeded:

```sql
-- Query database:
SELECT * FROM polling_job_status
WHERE job_name = 'poll-sender-emails'
ORDER BY started_at DESC
LIMIT 1;

-- Expected result:
status: 'success'
started_at: < 24 hours ago
completed_at: NOT NULL
```

❌ **If job failed or > 24h old:**
- Manually trigger sync job
- Check job logs for errors
- Verify Email Bison API is accessible

---

## Step 5: Developer Fixes (5 minutes)

If Steps 1-4 don't resolve it, apply these code fixes:

### Fix 1: Reduce Cache TTL (2 minutes)

**File:** `src/services/dataService.ts`
**Line:** 38

```typescript
// BEFORE:
const CACHE_TTL = {
  INFRASTRUCTURE: 60 * 60 * 1000, // 60 minutes
}

// AFTER:
const CACHE_TTL = {
  INFRASTRUCTURE: 10 * 60 * 1000, // 10 minutes ✅
}
```

### Fix 2: Increase Row Limit (1 minute)

**File:** `src/services/realtimeDataService.ts`
**Line:** 351

```typescript
// BEFORE:
.limit(totalCount || 10000)

// AFTER:
.limit(totalCount || 50000) // ✅ Increase to 50k
// OR even better:
.limit(totalCount) // ✅ No fallback
```

### Fix 3: Clear Cache on Context Init (2 minutes)

**File:** `src/contexts/DashboardContext.tsx`
**Line:** 520

```typescript
// BEFORE:
const TEN_MINUTES = 10 * 60 * 1000;

// AFTER:
const FIVE_MINUTES = 5 * 60 * 1000; // ✅ More aggressive refresh
```

**Save files** → Vite will auto-reload → Test dashboard

---

## 🔍 Quick Diagnostic Commands

### Check Database Count
```sql
SELECT COUNT(*) as total_records
FROM sender_emails_cache;
```

### Check Unique Emails Per Client
```sql
SELECT
  workspace_name,
  COUNT(DISTINCT email_address) as unique_emails
FROM sender_emails_cache
GROUP BY workspace_name
ORDER BY unique_emails DESC
LIMIT 10;
```

### Check Deduplication Impact
```sql
-- Total raw records
SELECT COUNT(*) FROM sender_emails_cache;

-- Unique by email+workspace
SELECT COUNT(DISTINCT email_address || '|' || workspace_name)
FROM sender_emails_cache;

-- Difference = duplicates removed
```

---

## 🎯 Expected Results

After applying fixes, you should see:

### In Console:
```
[Infrastructure] Fetching fresh data from sender_emails_cache...
[Infrastructure] Found 4234 total accounts in cache
[DEDUPLICATION] Removed 123 duplicates
[FINAL COUNT] 4111 unique accounts
✅ Fetched 4111 unique accounts in 1234ms
```

### On Dashboard:
```
┌─────────────────────────┐
│ Total Email Accounts    │
│      4,111             │ ← Should match DB count
└─────────────────────────┘

┌─────────────────────────┐
│ Avg per Client          │
│      44.2              │ ← Total / Unique Clients
└─────────────────────────┘

Last Updated: 2 minutes ago 🟢
```

### Typical Values:
- **Total Accounts:** 4,000 - 5,000
- **Unique Clients:** 80 - 100
- **Avg per Client:** 40 - 60
- **Duplicates Removed:** 100 - 200

---

## 🚨 Common Issues & Solutions

### Issue 1: "Totals haven't updated in an hour"

**Cause:** 60-minute cache TTL
**Solution:**
```
1. Click "Manual Refresh" button
2. OR wait for cache to expire
3. OR reduce cache TTL (Fix 1 above)
```

### Issue 2: "Shows fewer accounts than expected"

**Cause:** 10,000 row limit truncating data
**Solution:**
```
1. Check console for: "Found X total accounts"
2. If X = 10,000 exactly → hit the limit
3. Apply Fix 2 above (increase limit)
```

### Issue 3: "Client count is wrong"

**Cause:** May be correct! Deduplication is per-workspace
**Explanation:**
```
If john@example.com is used by Client A AND Client B:
  - Client A view: Shows john@example.com ✅
  - Client B view: Shows john@example.com ✅
  - Total view: Counts once (deduplicated) ✅

This is EXPECTED behavior!
```

### Issue 4: "Data shows > 24 hours old"

**Cause:** Nightly polling job failed
**Solution:**
```
1. Check polling_job_status table
2. Manually trigger: supabase functions invoke poll-sender-emails
3. Check Email Bison API is accessible
4. Review job error logs
```

---

## 📊 Verification Script

Run this in browser console to verify counts:

```javascript
// Get infrastructure data from context
const infraData = window.__DASHBOARD_CONTEXT__?.infrastructureDashboard;

console.log('Dashboard State:', {
  totalAccounts: infraData?.emailAccounts?.length,
  lastUpdated: infraData?.lastUpdated,
  isLoading: infraData?.loading,
  hasError: !!infraData?.error,
  cacheAge: infraData?.lastUpdated
    ? Math.round((Date.now() - new Date(infraData.lastUpdated).getTime()) / 60000) + ' min'
    : 'unknown'
});

// Count by client
const byClient = {};
infraData?.emailAccounts?.forEach(account => {
  const client = account.fields?.['Client']?.[0] || 'Unknown';
  byClient[client] = (byClient[client] || 0) + 1;
});

console.log('Top 10 Clients:', Object.entries(byClient)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10));
```

---

## 🎯 Success Criteria

✅ **Fix is successful when:**
- [ ] Dashboard shows fresh data (< 10 min old)
- [ ] Manual refresh updates totals correctly
- [ ] Console shows no errors
- [ ] Totals match database query
- [ ] All clients show expected account counts

---

## 📚 Related Documents

- **Detailed Audit:** [EMAIL_ACCOUNTS_AUDIT_REPORT.md](EMAIL_ACCOUNTS_AUDIT_REPORT.md)
- **Executive Summary:** [EMAIL_ACCOUNTS_AUDIT_SUMMARY.md](EMAIL_ACCOUNTS_AUDIT_SUMMARY.md)
- **Diagnosis:** [EMAIL_ACCOUNTS_DIAGNOSIS.md](EMAIL_ACCOUNTS_DIAGNOSIS.md)

---

## 🆘 Still Not Working?

If none of the above fixes work:

1. **Clear all caches:**
   ```javascript
   // In browser console:
   localStorage.clear();
   sessionStorage.clear();
   location.reload(true);
   ```

2. **Check database directly:**
   ```sql
   SELECT COUNT(*), MAX(last_synced_at)
   FROM sender_emails_cache;
   ```

3. **Restart dev server:**
   ```bash
   pkill -f "vite"
   npm run dev
   ```

4. **Review recent git commits:**
   ```bash
   git log --oneline -10
   # Look for deduplication or email-related changes
   ```

5. **Contact support with:**
   - Console error logs
   - Database query results
   - Screenshot of dashboard
   - Last polling job status

---

**Last Updated:** October 20, 2025
**Version:** 1.0
**Status:** ✅ Ready for Use