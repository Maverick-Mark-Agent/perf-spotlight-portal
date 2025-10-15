# Troubleshooting: Still Seeing 1000 Accounts

## Current Situation

- **Database has:** 1,866 accounts (verified via API)
- **Dashboard shows:** 1,000 accounts
- **Expected:** 1,866 accounts

## Root Cause Analysis

The issue is likely one of these:

### 1. Browser is Using Cached Code (Most Likely)
The code changes in `realtimeDataService.ts` haven't been picked up by the browser yet.

### 2. localStorage Cache
The old data (1000 accounts) might be cached in browser localStorage.

### 3. Feature Flag Not Active
The realtime service might not be enabled (though it should be).

## SOLUTION: Step-by-Step Fix

### Step 1: Clear Browser Cache & localStorage

**In Chrome/Edge:**
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to **Application** tab
3. Click **Clear site data** button
4. Refresh page (Cmd+Shift+R or Ctrl+Shift+R for hard refresh)

**Alternative - Console Command:**
```javascript
// Paste in browser console
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

### Step 2: Restart Dev Server

```bash
# Kill all running instances
pkill -f "vite"
pkill -f "npm run dev"

# Start fresh
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"
npm run dev
```

### Step 3: Verify Changes in Browser Console

Open the Email Infrastructure Dashboard and check console output:

**Expected console logs:**
```
[Infrastructure] fetchInfrastructureData called, force: false, useRealtime: true
[Infrastructure] Using real-time database query
[Infrastructure Realtime] Fetching from sender_emails_cache...
[Infrastructure Realtime] Found 1866 total accounts in cache  ← Should show 1866!
[Infrastructure Realtime] ✅ Fetched 1866 accounts in 250ms
```

**If you see this instead:**
```
[Infrastructure] Using Edge Function (fallback mode)
```
→ Feature flag is not active, code didn't reload

### Step 4: Check Network Tab

In DevTools **Network** tab:
- Should see: `POST /rest/v1/rpc/` or query to `sender_emails_cache`
- Should **NOT** see: `POST /functions/v1/hybrid-email-accounts-v2`

If you see the Edge Function call, the old code is still running.

### Step 5: Force Code Rebuild

If above steps don't work, force a complete rebuild:

```bash
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"

# Kill dev server
pkill -f vite
pkill -f "npm run dev"

# Clear all caches
rm -rf node_modules/.vite
rm -rf dist
rm -rf .turbo

# Restart
npm run dev
```

## Quick Diagnostic Script

Run this in browser console to diagnose the issue:

```javascript
// Check what's in localStorage
console.log('=== CACHE CHECK ===');
Object.keys(localStorage).forEach(key => {
  if (key.includes('infrastructure') || key.includes('email')) {
    const val = localStorage.getItem(key);
    console.log(key, ':', val ? val.substring(0, 100) : 'null');
  }
});

// Check feature flags
console.log('=== CHECKING FEATURE FLAGS ===');
// You'll need to import and check FEATURE_FLAGS.useRealtimeInfrastructure
```

## Verification Checklist

After completing steps above, verify:

- [ ] Browser console shows: `Found 1866 total accounts`
- [ ] Dashboard header shows: "1,866 accounts" (not 1,000)
- [ ] Network tab shows database queries (not Edge Function calls)
- [ ] All accounts visible when scrolling
- [ ] Load time < 2 seconds

## If Still Not Working

### Option A: Manual Database Query Test

Test if the database query works correctly:

```bash
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/sender_emails_cache?select=count" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Prefer: count=exact"
```

Should return: `[{"count":1866}]`

### Option B: Temporarily Disable Feature Flag

If realtime query has issues, temporarily fall back:

```typescript
// src/services/dataService.ts:27
const FEATURE_FLAGS = {
  useRealtimeInfrastructure: false, // ← Change to false temporarily
  useRealtimeKPI: true,
  useRealtimeVolume: true,
};
```

This will use the old Edge Function (slower but proven).

### Option C: Check for Code Syntax Errors

```bash
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"
npx tsc --noEmit
```

If there are TypeScript errors, fix them first.

## Common Gotchas

1. **Multiple dev servers running** - Kill all, start one
2. **Browser cache** - Always hard refresh (Cmd+Shift+R)
3. **Service Worker** - Check if one is active (Application tab → Service Workers → Unregister)
4. **Incognito mode** - Test in incognito to rule out extensions

## Expected Behavior After Fix

- Dashboard loads in ~1 second
- Shows **all 1,866 accounts** (not 1,000)
- Console logs confirm realtime query
- No Edge Function calls in Network tab
- Smooth scrolling through all accounts
