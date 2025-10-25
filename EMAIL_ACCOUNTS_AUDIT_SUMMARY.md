# Email Accounts Dashboard Audit - Executive Summary

## 🎯 Audit Objective
Diagnose why the **total number of email accounts** and **number of email accounts per client** displayed in the local dashboard may not be accurate and up-to-date.

---

## 🔍 Key Findings

### ✅ What's Working Correctly

1. **Data Architecture is Sound**
   - Real-time queries to `sender_emails_cache` table
   - Proper field transformations via `transformToEmailAccount()`
   - Correct calculation logic in UI layer

2. **Deduplication Logic is Correct**
   - Recent fix (commit `bbbb502`) changed from global to per-workspace deduplication
   - Now correctly handles same email across different clients
   - Removes true duplicates (same email+workspace from different bison instances)

3. **Manual Refresh Works**
   - Force refresh button clears cache and fetches fresh data
   - Logs show successful data fetching and processing

### ⚠️ Issues Identified

| Issue | Impact | Severity | Fix Priority |
|-------|--------|----------|--------------|
| **60-minute cache TTL** | Stale data for up to 1 hour | MEDIUM | HIGH |
| **Nightly sync only** | New accounts have 24h lag | LOW | N/A (Expected) |
| **10,000 row hard limit** | Silent data truncation if > 10k accounts | HIGH | HIGH |
| **Double caching** | Service + Context level caching | LOW | MEDIUM |

---

## 🔧 Root Causes of Inaccurate Data

### Primary Cause: **Long Cache Duration**
- **File:** [src/services/dataService.ts:38](src/services/dataService.ts#L38)
- **Current:** 60 minutes (1 hour)
- **Impact:** Dashboard shows old data until manual refresh or cache expiry
- **Why it exists:** Prevent constant API calls for large dataset (4000+ accounts)

### Secondary Cause: **10,000 Row Limit**
- **File:** [src/services/realtimeDataService.ts:351](src/services/realtimeDataService.ts#L351)
- **Code:** `.limit(totalCount || 10000)`
- **Impact:** If database has > 10,000 accounts, only first 10,000 are fetched
- **Risk:** SILENTLY truncates data without warning

### Tertiary Cause: **Browser Caching**
- Service workers and browser cache may store old data
- Requires hard refresh (Cmd+Shift+R) to clear

---

## 📊 Data Flow Summary

```
┌─────────────────────────┐
│  Email Bison API        │ (External source)
└───────────┬─────────────┘
            │ Nightly sync @ midnight
            ▼
┌─────────────────────────┐
│ sender_emails_cache     │ (Supabase table)
│ ~4,000-5,000 records    │
└───────────┬─────────────┘
            │ Real-time query (60-min cache)
            ▼
┌─────────────────────────┐
│ fetchInfrastructure     │ (realtimeDataService.ts)
│ DataRealtime()          │
└───────────┬─────────────┘
            │ Transform fields
            ▼
┌─────────────────────────┐
│ transformToEmailAccount │ (fieldMappings.ts)
└───────────┬─────────────┘
            │ Deduplicate by email+workspace
            ▼
┌─────────────────────────┐
│ Deduplication Logic     │ (removes ~100-200 dupes)
└───────────┬─────────────┘
            │ Store in context state
            ▼
┌─────────────────────────┐
│ DashboardContext        │ (infrastructureDashboard)
└───────────┬─────────────┘
            │ Calculate metrics
            ▼
┌─────────────────────────┐
│ EmailAccountsPage       │ (UI displays totals)
└─────────────────────────┘
```

---

## 🎯 Immediate Actions Required

### 1. **Reduce Cache TTL** ⚡ HIGH PRIORITY
```typescript
// File: src/services/dataService.ts:38
const CACHE_TTL = {
  INFRASTRUCTURE: 15 * 60 * 1000, // Change from 60 to 15 minutes
}
```

### 2. **Remove 10,000 Row Limit** ⚡ HIGH PRIORITY
```typescript
// File: src/services/realtimeDataService.ts:351
.limit(totalCount || 50000); // Increase safety fallback
// OR better: .limit(totalCount) only (no fallback)
```

### 3. **Add Cache Age Warning** ⚡ MEDIUM PRIORITY
```typescript
// File: src/pages/EmailAccountsPage.tsx
// Add banner: "Data is 45 minutes old - Click Refresh for latest"
```

---

## 🧪 How to Verify Data Accuracy

### Quick Verification Steps:

1. **Check Console Logs** (Open browser DevTools → Console)
   ```
   Look for:
   ✅ "[Infrastructure Realtime] ✅ Fetched X unique accounts in Yms"
   ✅ "📊 Dashboard Stats Calculated: { totalAccounts: X, ... }"
   ✅ "[DEDUPLICATION COMPLETE] Removed X duplicates"
   ```

2. **Force Refresh**
   ```
   Click "Manual Refresh" button on dashboard
   Wait 2-3 seconds
   Check if totals changed
   ```

3. **Hard Reload Browser**
   ```
   Mac: Cmd + Shift + R
   Windows: Ctrl + Shift + R
   ```

4. **Check Last Updated Timestamp**
   ```
   Green indicator (< 6h) = Fresh data ✅
   Yellow indicator (6-24h) = Stale data ⚠️
   Red indicator (> 24h) = Very stale ❌
   ```

---

## 📈 Expected Metrics

Based on recent commits and deduplication fixes:

| Metric | Expected Range | Notes |
|--------|----------------|-------|
| **Total Accounts** | 4,000 - 5,000 | After deduplication |
| **Unique Clients** | 80 - 100 | Active clients with email accounts |
| **Avg per Client** | 40 - 60 | Total / Unique Clients |
| **Duplicates Removed** | 100 - 200 | Same email+workspace, different instance |

### Specific Test Cases:

- **Shane Miller:** Should show **444 accounts** (per git commit `bbbb502`)
- **Deduplication:** Should remove ~5-10% of raw records

---

## 📝 Console Logs to Monitor

### ✅ Success Messages:
```
🚀🚀🚀 [REALTIME SERVICE] fetchInfrastructureDataRealtime() called!
[Infrastructure Realtime] Found 4234 total accounts in cache
✅✅✅ [DEDUPLICATION COMPLETE] Removed 123 duplicates
✅✅✅ [FINAL COUNT] 4111 unique accounts
📊 Dashboard Stats Calculated: { totalAccounts: 4111, uniqueClients: 93, avgPerClient: '44.2' }
```

### ⚠️ Warning Messages:
```
[Infrastructure Realtime] Data is 25.3 hours old - polling job may have failed
[Infrastructure] Using cached data (age: 45m, expires in: 15m)
⚠️ Bypassing validation temporarily for debugging
```

### ❌ Error Messages:
```
❌ [Infrastructure Realtime] Database error: ...
[Infrastructure] Fetch failed: ...
```

---

## 🚀 Testing Checklist

Before marking this as resolved:

- [ ] Reduce cache TTL to 10-15 minutes
- [ ] Remove or increase 10,000 row limit
- [ ] Test with manual refresh - verify counts update
- [ ] Test with hard browser reload - verify counts persist
- [ ] Check console logs for errors
- [ ] Verify Shane Miller shows 444 accounts
- [ ] Export data to CSV and manually verify count
- [ ] Check polling job ran within last 24 hours
- [ ] Verify last_synced_at is recent in database

---

## 📚 Detailed Report

For full technical details, architecture diagrams, and code references, see:
**[EMAIL_ACCOUNTS_AUDIT_REPORT.md](EMAIL_ACCOUNTS_AUDIT_REPORT.md)**

---

## ✅ Conclusion

The email accounts dashboard is **fundamentally working correctly**. The data flow architecture is sound, and the deduplication logic is accurate.

**If users see inaccurate totals, it's most likely due to:**
1. Stale cache (60-min TTL) - **Solution:** Click "Manual Refresh"
2. Browser cache - **Solution:** Hard reload (Cmd+Shift+R)
3. Data not synced yet (nightly job) - **Solution:** Wait for next sync at midnight

**Recommended Fixes:**
- Reduce cache TTL from 60 to 15 minutes
- Remove 10,000 row limit or increase to 50,000
- Add prominent cache age indicator in UI

---

**Audit Completed:** October 20, 2025
**Status:** ✅ Issues Identified, Recommendations Provided
**Next Steps:** Implement HIGH priority fixes and re-test