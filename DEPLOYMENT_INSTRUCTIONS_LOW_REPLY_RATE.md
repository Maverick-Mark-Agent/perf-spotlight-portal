# Deployment Instructions - Low Reply Rate Feature & Timestamp Fix

## What Changed

### 1. Fixed Timestamp Issue
**File:** `src/services/realtimeDataService.ts` (line 444)
- **Before:** `timestamp: new Date()` (showed current time, not actual sync time)
- **After:** `timestamp: mostRecentSync` (shows real sync time from database)

### 2. Added Low Reply Rate Feature
**File:** `src/pages/EmailAccountsPage.tsx`
- New dropdown option: "Low Reply Rate (<0.4%)"
- Filters accounts with <0.4% reply rate and 200+ emails sent
- CSV export functionality
- Grouped by email provider

## How to Deploy to Production

### Option 1: Vercel Auto-Deploy (Recommended)
If your repo is connected to Vercel:

```bash
# 1. Commit the changes
git add .
git commit -m "fix: Add low reply rate monitoring and fix infrastructure sync timestamp

FEATURES:
- Add Low Reply Rate (<0.4%) filter to Email Provider Performance
- Filter accounts with <0.4% reply rate and 200+ emails sent minimum
- CSV export for burnt mailbox identification
- Grouped by provider with metrics display

FIXES:
- Fix infrastructure dashboard showing incorrect 'Synced 10d ago'
- Use actual last_synced_at from database instead of current time
- Both users now see same sync timestamp

FILES CHANGED:
- src/services/realtimeDataService.ts (timestamp fix)
- src/pages/EmailAccountsPage.tsx (low reply rate feature)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 2. Push to main branch
git push origin main

# 3. Vercel will auto-deploy
# Check deployment status at: https://vercel.com/dashboard
```

### Option 2: Manual Vercel Deploy
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy to production
npx vercel --prod
```

### Option 3: Manual Build & Deploy
If you're using a different hosting provider:

```bash
# 1. Build production bundle
npm run build

# 2. Upload dist/ folder to your hosting provider
# The built files are in the dist/ directory
```

## Verification Steps

### After Deployment:

#### 1. Verify Timestamp Fix
1. Go to https://www.maverickmarketingllc.com/email-accounts
2. Look at the red warning banner at the top
3. **Before fix:** "Last synced 10d ago"
4. **After fix:** Should show the actual sync time (likely "Last synced 1d ago" or similar)
5. **Important:** Do a hard refresh (`Cmd+Shift+R` on Mac, `Ctrl+Shift+R` on Windows) to clear cache

#### 2. Verify Low Reply Rate Feature
1. Scroll down to **"Email Provider Performance"** section (below the overview cards)
2. Click the dropdown that says **"Show:"**
3. You should see the new option: **"Low Reply Rate (<0.4%)"**
4. Select it to see metrics like:
   ```
   Gmail
   - Burnt Accounts: 15
   - Total Sent (Low RR): 45,200
   - Accounts to Cancel: 15 accounts
   ```

#### 3. Test CSV Export
1. Select "Low Reply Rate (<0.4%)" view
2. Click any provider row to expand
3. Click the "Download" button
4. Verify CSV downloads with filename: `{Provider}_low_reply_rate_2025-12-12.csv`
5. Open CSV and verify columns:
   - Account Name, Client, Status, Total Sent, Total Replied, Reply Rate %, Daily Limit

## Current Status

✅ **Code Changes:** Complete
✅ **Build Test:** Successful (no TypeScript errors)
❌ **Deployment:** Not deployed to production yet
❌ **Live Site:** Still showing old code

## Where to Find the New Feature

The "Low Reply Rate (<0.4%)" feature is located in:

**Page:** Email Accounts Infrastructure (`/email-accounts`)

**Section:** "Email Provider Performance" (scroll down past the overview cards)

**Dropdown:** Click "Show:" and select "Low Reply Rate (<0.4%)"

**NOT in the alert boxes** - The existing "<2% reply rate" alert box is a different feature

## Why You Don't See It Yet

1. **Production site is cached** - You're viewing the old deployed version
2. **New code not deployed** - Changes are only in local development
3. **Browser cache** - Even after deploy, you'll need to hard refresh

## Next Steps

1. **Choose deployment method** (Option 1 recommended)
2. **Deploy to production**
3. **Hard refresh browser** after deploy completes
4. **Verify both fixes work**

## Troubleshooting

### "I still see 10d ago after deploying"
- Do a hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Clear browser cache completely
- Try incognito/private browsing window
- Check Vercel deployment completed successfully

### "I don't see the Low Reply Rate option"
- Scroll down to "Email Provider Performance" section (below overview cards)
- Look for dropdown that says "Show:"
- If still not there, verify deployment succeeded
- Check browser console for JavaScript errors

### "Dropdown is there but shows no data"
- The feature only shows providers that have burnt accounts
- If all accounts have >0.4% reply rate, counts will show 0
- Try "100+ No Replies" view to verify provider list is working

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors (F12)
3. Verify the timestamp of deployed files
4. Confirm you're looking at the right section (Email Provider Performance)

---

**Deployment Date:** Pending
**Status:** Ready for deployment
**Impact:** Low (additive feature, no breaking changes)
