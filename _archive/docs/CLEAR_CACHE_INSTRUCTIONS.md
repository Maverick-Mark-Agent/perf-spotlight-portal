# 🧹 Cache Clearing Instructions

## Problem
You're seeing "N/A" for Provider and Reseller despite the fix being deployed.

## Root Cause
Browser is caching old data. Even with cache TTL = 0, React may have stale data in memory.

## Solution: Complete Cache Clear

### Step 1: Close ALL Tabs
- Close ALL browser tabs showing maverickmarketingllc.com
- Quit the browser completely (Cmd+Q)

### Step 2: Clear Browser Cache
**Chrome:**
1. Reopen Chrome
2. Press Cmd+Shift+Delete
3. Select "Cached images and files"
4. Time range: "All time"
5. Click "Clear data"

**Safari:**
1. Reopen Safari
2. Safari menu → Clear History
3. Select "all history"
4. Click "Clear History"

### Step 3: Test with Test Page (Bypass React)
1. Go to: https://www.maverickmarketingllc.com/test-api-live.html
2. Click "Fetch Accounts from API"
3. Verify you see Provider and Reseller data

**Expected output:**
```
1. jason.b@binyonagencypros.com
   Workspace: Jason Binyon
   Provider: Outlook
   Reseller: Mailr
```

If you see "NULL" here, the database view is missing columns.
If you see correct data here, then React is the issue.

### Step 4: Hard Refresh Dashboard
1. Go to: https://www.maverickmarketingllc.com/email-accounts
2. Press Cmd+Shift+R (hard refresh) **3 times**
3. Open DevTools Console (F12 → Console tab)
4. Look for: `[Infrastructure Realtime] Fetching from email_accounts_view`
5. Click "434 Burnt Mailboxes" alert
6. Click "View All 434"

### Step 5: Check Console for Data
In the browser console, you should see the actual account objects.
Type this in console:
```javascript
// Check what data the React app has
console.log(window.__REACT_DEVTOOLS_GLOBAL_HOOK__)
```

### Alternative: Use Incognito/Private Mode
1. Open new Incognito window (Cmd+Shift+N)
2. Go to: https://www.maverickmarketingllc.com/email-accounts
3. Check if Provider/Reseller show correctly

If it works in Incognito, the issue is definitely browser cache.

## Verification

### What You Should See:
✅ Provider column: "Outlook", "Google", "Microsoft"
✅ Reseller column: "Mailr", "CheapInboxes", "ScaledMail", "Zapmail"
✅ CSV export has 9 columns with provider/reseller data

### If Still Showing N/A:
Run test page first to isolate:
- Test page shows data → React caching issue
- Test page shows NULL → Database view issue

Let me know which scenario you see.
