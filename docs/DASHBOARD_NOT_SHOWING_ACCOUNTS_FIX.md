# Dashboard Not Showing Accounts - Fix Steps

**Issue**: 4,677 accounts in database but dashboard shows 0 accounts
**Root Cause**: Browser cache or stale DashboardContext

---

## ✅ Verified Working:
1. ✅ Database has 4,677 accounts
2. ✅ Data transformation working perfectly
3. ✅ API queries returning all accounts
4. ✅ `sender_emails_cache` table structure correct
5. ✅ Field mappings correct (`transformToEmailAccount`)

---

## 🔧 Fix Steps (Try in order):

### Step 1: Hard Refresh Browser (30 seconds)

1. **Open your dashboard** in browser
2. **Hard refresh** to clear cache:
   - **Mac**: `Cmd + Shift + R` or `Cmd + Option + R`
   - **Windows/Linux**: `Ctrl + Shift + R`
3. **Check** if accounts now show

---

### Step 2: Clear Browser Storage (1 minute)

If Step 1 didn't work:

1. **Open Dev Tools**: `F12` or `Cmd + Option + I`
2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Clear everything**:
   - Click "Clear site data" (Chrome)
   - Or manually delete:
     - LocalStorage
     - SessionStorage
     - IndexedDB
     - Cookies
4. **Refresh page**
5. **Check** if accounts show

---

### Step 3: Check Browser Console for Errors (2 minutes)

1. **Open Dev Tools**: `F12`
2. **Go to Console tab**
3. **Look for errors** (red text)
4. **Share any errors** you see (screenshot or copy-paste)

Common errors to look for:
- `CORS` errors
- `401 Unauthorized` errors
- `Failed to fetch` errors
- `TypeError` errors related to `emailAccounts`

---

### Step 4: Manually Trigger Data Refresh (1 minute)

In the browser console, run:

```javascript
// Check if data is loaded
console.log('Email Accounts:', window.__dashboard_context__?.infrastructureDashboard?.emailAccounts);

// Force refresh
window.location.reload(true);
```

---

### Step 5: Check Network Tab (2 minutes)

1. **Open Dev Tools**: `F12`
2. **Go to Network tab**
3. **Refresh page**
4. **Look for**:
   - Request to `sender_emails_cache` or `fetchInfrastructureDataRealtime`
   - Check if it returns 200 OK
   - Check response data (should show 4677 accounts)

---

### Step 6: Restart Dev Server (2 minutes)

If nothing above works:

1. **Stop dev server**:
   ```bash
   # In terminal where `npm run dev` is running
   # Press Ctrl + C
   ```

2. **Clear node_modules cache** (optional but recommended):
   ```bash
   cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"
   rm -rf .vite
   ```

3. **Restart dev server**:
   ```bash
   npm run dev
   ```

4. **Open fresh browser tab**
5. **Navigate to dashboard**

---

## 🔍 Debugging: Check What's Actually Happening

### Option A: Check Context State (Browser Console)

```javascript
// Check DashboardContext state
const ctx = window.__dashboard_context__;
console.log('Infrastructure Dashboard State:', {
  emailAccounts: ctx?.infrastructureDashboard?.emailAccounts,
  accountCount: ctx?.infrastructureDashboard?.emailAccounts?.length,
  loading: ctx?.infrastructureDashboard?.loading,
  lastUpdated: ctx?.infrastructureDashboard?.lastUpdated,
  error: ctx?.infrastructureDashboard?.error
});
```

### Option B: Test Data Fetch Directly (Browser Console)

```javascript
// Create Supabase client
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

// Fetch accounts
const { data, error, count } = await supabase
  .from('sender_emails_cache')
  .select('*', { count: 'exact' })
  .limit(100);

console.log('Direct Fetch Result:', {
  count,
  fetched: data?.length,
  firstAccount: data?.[0],
  error
});
```

---

## 🎯 Expected Behavior After Fix

1. ✅ Dashboard shows **4,677 total accounts**
2. ✅ Accounts grouped by:
   - Client (Kim Wallace: 280, Jeff Schroder: 70, etc.)
   - Status (Connected, Disconnected, etc.)
   - Provider (Gmail, Microsoft, etc.)
3. ✅ Charts populate with data
4. ✅ No loading spinner stuck forever
5. ✅ "Last synced" timestamp shows recent time

---

## 🚨 If STILL Not Working

### Check Feature Flag

The dashboard uses a feature flag to switch between data sources. Check:

**File**: `src/services/dataService.ts` (line 26-30)

```typescript
const FEATURE_FLAGS = {
  useRealtimeInfrastructure: true, // Should be TRUE
  useRealtimeKPI: true,
  useRealtimeVolume: true,
}
```

If `useRealtimeInfrastructure` is `false`, change it to `true` and restart dev server.

---

## 📞 What to Share If Still Broken

1. **Screenshot** of dashboard showing 0 accounts
2. **Browser console errors** (screenshot or text)
3. **Network tab**:
   - Screenshot of requests to Supabase
   - Response from `sender_emails_cache` query
4. **Result** of running debugging commands above

---

## ✅ Quick Checklist

- [ ] Hard refresh browser (Cmd + Shift + R)
- [ ] Clear browser storage (Dev Tools → Application → Clear)
- [ ] Check console for errors
- [ ] Verify Network tab shows 200 OK responses
- [ ] Restart dev server if needed
- [ ] Open fresh browser tab
- [ ] Confirm `useRealtimeInfrastructure: true` in dataService.ts

---

**Most likely fix**: Step 1 (Hard Refresh) or Step 2 (Clear Storage) should work!
