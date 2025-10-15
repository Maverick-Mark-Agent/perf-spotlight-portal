# David Amiri Client Portal Lead Investigation - October 15, 2025

## Issue Report
**Client:** David Amiri
**Reported Issue:** Last lead showing was from Oct 12, missing leads since then
**Investigation Date:** October 15, 2025

---

## Executive Summary

✅ **GOOD NEWS:** David Amiri's leads ARE being captured correctly in the database. The system is working as intended.

**Key Findings:**
- David Amiri has **216 total leads** in the `client_leads` table
- **Most recent lead:** October 15, 2025 (TODAY) - Celso Ruiz
- **2 leads since Oct 12:** Celso Ruiz (Oct 15) and Marcelino Aguirre (Oct 12)
- All leads are properly marked as `interested=true`
- All leads are in the correct pipeline stage (`interested`)
- Database query simulation returns correct data

**Root Cause:** The issue is NOT with data capture - it's a **frontend display/authentication issue** in the client portal.

---

## Detailed Investigation

### 1. Database Architecture Discovery

The client portal uses a different system than initially assumed:

```
INCORRECT ASSUMPTION:
client_registry → lead_sources → raw_leads → cleaned_leads

ACTUAL ARCHITECTURE:
client_registry → client_leads (populated via Bison webhooks)
```

**Key Table:** `client_leads` stores all leads from Email Bison webhooks

### 2. Data Verification

#### David Amiri's Lead Statistics:
```
Total leads: 216
Interested leads: 216 (100%)
Leads since Oct 12: 2
  - Oct 15: Celso Ruiz
  - Oct 12: Marcelino Aguirre
```

#### Recent Leads (Last 10):
1. 2025-10-15 - Celso Ruiz ✓
2. 2025-10-12 - Marcelino Aguirre ✓
3. 2025-10-10 - Anthony Perry
4. 2025-10-10 - Debra Patterson
5. 2025-10-09 - Jacqueline Stuemky
6. 2025-10-09 - Brian Edmonds
7. 2025-10-08 - mary Ellen Swanson
8. 2025-10-08 - Bethany Graff
9. 2025-10-07 - Ravi chandra reddy
10. 2025-10-07 - Christi Shoppach

### 3. Query Simulation

Tested the exact query used by `ClientPortalPage.tsx`:

```typescript
supabase
  .from('client_leads')
  .select('*')
  .eq('interested', true)
  .eq('workspace_name', 'David Amiri')
  .order('date_received', { ascending: false })
  .range(0, 9999)
```

**Result:** ✅ Returns 216 leads correctly, including all recent leads

### 4. All Client Portal Status Check

Checked last lead date for all 35 client portal accounts:

**Active (leads within 2 days):**
- ✓ ATI: 0 days ago
- ✓ Danny Schwartz: 1 day ago
- ✓ David Amiri: 0 days ago ← **CONFIRMED ACTIVE**
- ✓ Devin Hodo: 0 days ago
- ✓ Jason Binyon: 0 days ago
- ✓ Jeff Schroder: 1 day ago
- ✓ Kim Wallace: 0 days ago
- ✓ Nick Sakha: 0 days ago
- ✓ Rob Russell: 2 days ago
- ✓ StreetSmart Commercial: 1 day ago
- ✓ StreetSmart Trucking: 0 days ago
- ✓ Tony Schmitz: 0 days ago

**Potentially Stale (3+ days):**
- ⚠️ John Roberts: 3 days ago
- ⚠️ Kirk Hodgson: 4 days ago
- ⚠️ SMA Insurance: 5 days ago
- ⚠️ Radiant Energy: 8 days ago
- ⚠️ StreetSmart P&C: 13 days ago
- ⚠️ LongRun: 26 days ago
- ⚠️ Maverick In-house: 78 days ago

**No Leads:**
- ❌ 14 clients have no leads in the system

---

## Possible Causes for Frontend Issue

Since the data is correct in the database, the issue must be one of the following:

### 1. **Row Level Security (RLS) Policy** ⭐ MOST LIKELY
The client portal may have RLS policies that filter leads based on the logged-in user. If David is logged in, the RLS policy might be incorrectly filtering his results.

**Action Required:** Check RLS policies on `client_leads` table

### 2. **Caching Issue**
The browser or application might be caching old data.

**Action Required:** Have David hard-refresh (Cmd+Shift+R) or clear browser cache

### 3. **Authentication State**
If David is using the authenticated portal, there might be a workspace mismatch in the auth system.

**Action Required:** Check `useSecureWorkspaceData` hook and Edge Function permissions

### 4. **Frontend Filtering Bug**
There might be additional client-side filtering that's hiding recent leads.

**Action Required:** Check React state management and filtering logic

### 5. **Date/Timezone Issue**
Possible timezone conversion issue causing recent leads to not display.

**Action Required:** Check date formatting in `ClientPortalPage.tsx` line 659-666

---

## Recommended Actions

### Immediate Actions (for David):

1. **Try hard refresh:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Try different browser:** Test in incognito/private mode
3. **Clear browser cache** for the portal domain
4. **Re-login:** Log out and log back in

### Technical Investigation:

1. **Check RLS Policies:**
```sql
-- View RLS policies on client_leads
SELECT * FROM pg_policies WHERE tablename = 'client_leads';
```

2. **Test unauthenticated access:**
   - Navigate to `/client-portal/David%20Amiri` without logging in
   - See if leads appear

3. **Check browser console:**
   - Open DevTools (F12)
   - Look for JavaScript errors or failed API calls
   - Check Network tab for Supabase queries

4. **Verify Edge Function (if using auth):**
   - Test `get-workspace-data` Edge Function
   - Check if it's properly filtering leads

### Code Review Points:

**File:** `src/pages/ClientPortalPage.tsx`

- Line 437: `eq('interested', true)` - Verified all David's leads have this flag ✓
- Line 442: `eq('workspace_name', workspace)` - Verified exact match required ✓
- Line 438-439: `order` and `range` - No issues found ✓

**File:** `src/hooks/useSecureWorkspaceData.ts`
- May contain additional filtering logic for authenticated users

---

## Next Steps

1. **Get user feedback:** Ask David to try the immediate actions above
2. **Enable debug logging:** Add console.log to `fetchLeads()` function
3. **Check RLS policies:** Investigate Row Level Security on `client_leads`
4. **Test both auth modes:** Try both authenticated and unauthenticated portal access
5. **Monitor browser console:** Have David share any error messages

---

## Files Created for Investigation

- `scripts/check-david-amiri-comprehensive.ts` - Full workspace check
- `scripts/check-david-client-leads.ts` - Client leads verification
- `scripts/check-david-interested-flag.ts` - Interested flag verification
- `scripts/simulate-portal-query.ts` - Query simulation
- `scripts/check-bison-webhook-leads.ts` - Webhook system check

---

## Conclusion

The database and backend systems are functioning correctly. David Amiri's leads ARE being captured and stored properly, with the most recent lead from today (Oct 15). The issue is isolated to the **frontend display layer** or **authentication/permission layer**, most likely related to:

1. **Browser caching** (easiest to fix - just refresh)
2. **RLS policies** (requires database investigation)
3. **Authentication state** (requires Edge Function review)

Recommended immediate action: Have David try a hard refresh and re-login. If that doesn't work, proceed with technical investigation of RLS policies.
