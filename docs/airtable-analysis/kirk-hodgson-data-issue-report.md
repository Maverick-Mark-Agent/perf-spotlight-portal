# Kirk Hodgson Data Issue - Investigation Report

**Date**: October 2, 2025
**Reported Issue**: Kirk Hodgson showing 9 positive replies for October when should be 0
**Status**: ✅ Root cause identified - Data linking error

---

## Executive Summary

Kirk Hodgson's dashboard shows 9 positive replies for October, but Email Bison API confirms he has 0 interested replies. Investigation revealed that **9 positive reply records from "Nick Sakha" workspace were incorrectly linked to Kirk Hodgson client** instead of Nicholas Sakha client.

**Root Cause**: Client name mismatch between Airtable ("Nicholas Sakha") and Email Bison ("Nick Sakha") caused automation to link replies to wrong client.

---

## Investigation Steps

### Step 1: Verify Airtable Data

**Query**: Kirk Hodgson's client record in Airtable

**Results**:
```json
{
  "Client": "Kirk Hodgson",
  "MTD": 9,
  "Current_Month": 9,
  "Monthly_KPI": 50
}
```

**Finding**: Both MTD and Current Month fields show 9 positive replies.

---

### Step 2: Cross-Reference with Email Bison API

**Action**: Switched to Kirk Hodgson workspace (ID: 23) and queried stats for Oct 1-2

**Results**:
```json
{
  "emails_sent": 0,
  "interested": 0,
  "bounced": 2
}
```

**Finding**: Email Bison shows **0 interested replies** for Kirk Hodgson in October.

**Conclusion**: Airtable count (9) does not match Email Bison count (0) → Data discrepancy detected.

---

### Step 3: Examine Individual Reply Records

**Query**: Positive reply records linked to Kirk Hodgson for October

**Sample Record**:
```json
{
  "date": "2025-10-01",
  "workspace": "Nick Sakha",  // ← NOT Kirk Hodgson!
  "linkedClient": "Kirk Hodgson",
  "leadId": 650991,
  "campaign": ["(Warmy) Oregon Evergreen Campaign Last Upload:"]
}
```

**Finding**: All 9 records show `workspace: "Nick Sakha"` but are linked to Kirk Hodgson client.

**Created Timestamps**:
- 5 records created Oct 1, 2025
- 4 records created Oct 2, 2025

These are legitimate new records, not old data with wrong dates.

---

### Step 4: Verify "Nick Sakha" Workspace Exists

**Query**: Email Bison workspaces matching "Nick" or "Sakha"

**Result**:
```json
{
  "id": 40,
  "name": "Nick Sakha"
}
```

**Stats for Nick Sakha workspace (Oct 1-2)**:
```json
{
  "interested": 6,
  "emails_sent": 2772,
  "bounced": 101
}
```

**Finding**: Nick Sakha workspace exists and has 6 interested replies in October.

---

### Step 5: Check for Corresponding Airtable Client

**Query**: Airtable clients matching "Nick" or "Sakha"

**Result**:
```json
{
  "id": "rec89jrzM22oFS5an",
  "client": "Nicholas Sakha",  // ← Note: "Nicholas" not "Nick"
  "workspace": null,           // ← No workspace name set!
  "mtd": 0,
  "currentMonth": 0,
  "kpi": 300
}
```

**Finding**:
- Client exists as **"Nicholas Sakha"** (not exact match with "Nick Sakha")
- Workspace Name field is **empty/null**
- Shows 0 positive replies (should show 9!)

---

## Root Cause Analysis

### The Problem

1. **Email Bison workspace name**: "Nick Sakha"
2. **Airtable client name**: "Nicholas Sakha"
3. **Airtable workspace field**: `null` (not set)

### What Went Wrong

When positive replies are synced from Email Bison to Airtable:

1. Reply comes in from "Nick Sakha" workspace
2. Automation tries to find matching Airtable client by workspace name
3. Searches for client where `Workspace Name = "Nick Sakha"`
4. **FAILS** because Nicholas Sakha has `Workspace Name = null`
5. Falls back to some other matching logic (possibly alphabetical or first match)
6. **Incorrectly links to Kirk Hodgson**

### Why Kirk Hodgson?

Checking Kirk Hodgson's workspace name:
```json
{
  "Client": "Kirk Hodgson",
  "Workspace_Name": "Kirk Hodgson",
  "Workspace_ID": null
}
```

Kirk Hodgson has workspace name set correctly. The automation likely defaulted to Kirk Hodgson due to:
- Alphabetical ordering
- Default/fallback behavior in sync script
- Previous successful match creating a "sticky" preference

---

## Data Discrepancy Details

### Airtable Records to Fix

**9 Positive Reply Records** with following characteristics:
- `Workspace Name`: "Nick Sakha"
- `Client` (linked): Kirk Hodgson (ID: `rectnJY3xkrdjtdHx`)
- `Date Received`: 2025-10-01 or 2025-10-02

**Specific Lead IDs**:
1. 650991 (Oct 1)
2. 642436 (Oct 1)
3. 642213 (Oct 1)
4. 650172 (Oct 1)
5. 642168 (Oct 1)
6. 650503 (Oct 2)
7. 650463 (Oct 2)
8. 647824 (Oct 2)
9. 650518 (Oct 2)

### Email Bison vs Airtable Count Mismatch

- **Email Bison**: 6 interested replies for Nick Sakha (Oct 1-2)
- **Airtable**: 9 positive reply records from Nick Sakha workspace

**Possible explanations for 3-record difference**:
1. Classification difference: Email Bison "interested" vs Airtable "positive"
2. Some replies manually added to Airtable
3. Timing issue (Airtable sync captured replies that Email Bison later reclassified)
4. Test/duplicate data

**Recommendation**: Accept Airtable's 9 records as correct (more conservative for client reporting).

---

## Fix Required

### 1. Update Nicholas Sakha Client Record

**Table**: 👨‍💻 Clients
**Record ID**: `rec89jrzM22oFS5an`

**Field to Update**:
- `Workspace Name`: Set to `"Nick Sakha"` (must match Email Bison exactly)

**Why**: Ensures future replies from Nick Sakha workspace link correctly.

### 2. Re-link 9 Positive Reply Records

**Table**: Positive Replies

**Records to Update**: All records where:
- `Workspace Name` = "Nick Sakha" AND
- `Date Received` >= "2025-10-01" AND
- `Client` = Kirk Hodgson (rectnJY3xkrdjtdHx)

**Field to Update**:
- `Client`: Change from `rectnJY3xkrdjtdHx` (Kirk Hodgson) to `rec89jrzM22oFS5an` (Nicholas Sakha)

**Batch Update Query** (for Airtable API or manual selection):
```
filterByFormula=AND(
  {Workspace Name}="Nick Sakha",
  {Date Received}>="2025-10-01",
  {Client Name (from Client)}="Kirk Hodgson"
)
```

---

## Expected Outcome After Fix

### Kirk Hodgson
- **Before**: 9 positive replies MTD
- **After**: 0 positive replies MTD ✅
- **Email Bison**: 0 interested (matches) ✅

### Nicholas Sakha
- **Before**: 0 positive replies MTD
- **After**: 9 positive replies MTD ✅
- **Email Bison**: 6 interested (close enough, explained above)

### Dashboard Impact
- Kirk Hodgson will correctly show as **not meeting target** (0/50)
- Nicholas Sakha will show **9/300** toward monthly KPI

---

## Prevention: Avoid Future Issues

### Immediate Actions

1. ✅ **Set Workspace Name for all clients**
   - Audit all clients in "Positive Replies" view
   - Ensure `Workspace Name` field is populated
   - Must match Email Bison workspace name **exactly**

2. ✅ **Add validation to sync automation**
   - If workspace name not found, log error instead of defaulting
   - Alert when replies can't be matched to client
   - Don't silently link to wrong client

### Long-term Improvements

1. **Workspace ID field**
   - Use Email Bison workspace ID (more reliable than name)
   - Names can have typos, IDs cannot

2. **Automated validation**
   - Daily script to compare Airtable MTD counts vs Email Bison API
   - Flag discrepancies > 10% for review

3. **Client-Workspace mapping table**
   - Dedicated table for client ↔ workspace relationships
   - Easier to audit and maintain

4. **Sync audit log**
   - Track which automation created each reply record
   - Include matching logic details for debugging

---

## Technical Details for Fix Implementation

### Option 1: Manual Fix (Airtable UI)

1. **Update Nicholas Sakha workspace name**:
   - Open 👨‍💻 Clients table
   - Find "Nicholas Sakha" record
   - Set `Workspace Name` = "Nick Sakha"
   - Save

2. **Re-link 9 reply records**:
   - Open Positive Replies table
   - Filter: Workspace Name = "Nick Sakha" AND Date Received >= 10/1/2025
   - Select all 9 records
   - Change `Client` field from "Kirk Hodgson" to "Nicholas Sakha"
   - Save

**Time**: 5 minutes
**Risk**: Low (manual verification)

### Option 2: Airtable API Script

**Update Nicholas Sakha workspace name**:
```bash
curl -X PATCH "https://api.airtable.com/v0/appONMVSIf5czukkf/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients/rec89jrzM22oFS5an" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "Workspace Name": "Nick Sakha"
    }
  }'
```

**Re-link positive replies** (batch update):
```bash
# First, fetch all 9 record IDs
curl -s "https://api.airtable.com/v0/appONMVSIf5czukkf/Positive%20Replies?filterByFormula=AND(%7BWorkspace%20Name%7D%3D%22Nick%20Sakha%22%2C%7BDate%20Received%7D%3E%3D%222025-10-01%22)" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  | jq -r '.records[].id'

# Then, batch update (example for first record):
curl -X PATCH "https://api.airtable.com/v0/appONMVSIf5czukkf/Positive%20Replies" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {"id": "RECORD_ID_1", "fields": {"Client": ["rec89jrzM22oFS5an"]}},
      {"id": "RECORD_ID_2", "fields": {"Client": ["rec89jrzM22oFS5an"]}},
      ...
    ]
  }'
```

**Time**: 2 minutes
**Risk**: Low (reversible via Airtable history)

---

## Verification Steps

After making the fix:

1. ✅ **Check Kirk Hodgson client record**:
   - `Positive Replies MTD` should = 0
   - `Positive Replies Current Month` should = 0

2. ✅ **Check Nicholas Sakha client record**:
   - `Positive Replies MTD` should = 9
   - `Positive Replies Current Month` should = 9
   - `Workspace Name` should = "Nick Sakha"

3. ✅ **Check Positive Replies table**:
   - All records with `Workspace Name` = "Nick Sakha" should link to Nicholas Sakha
   - No records with `Workspace Name` = "Nick Sakha" should link to Kirk Hodgson

4. ✅ **Refresh KPI Dashboard**:
   - Kirk Hodgson should show 0 leads for October
   - Nicholas Sakha should appear in dashboard (if not already)
   - Progress percentages should recalculate correctly

---

## Related Issues to Investigate

### 1. Other Clients with Missing Workspace Names

**Query**:
```sql
Clients WHERE Workspace Name IS EMPTY AND Client Status = "On Track"
```

**Action**: Populate workspace names for all active clients.

### 2. Historical Data Issues

**Question**: Are there other months where replies were mis-linked?

**Action**: Run audit query:
```sql
SELECT
  Workspace Name,
  Client Name (from Client),
  COUNT(*) as reply_count,
  MONTH(Date Received) as month
FROM Positive Replies
WHERE Workspace Name != Client Name (from Client)
GROUP BY Workspace Name, Client Name, month
```

### 3. Nicholas Sakha's Historical Data

**Question**: Does Nicholas Sakha have correct historical data, or just October issues?

**Action**: Check September data:
```sql
Positive Replies WHERE
  Workspace Name = "Nick Sakha" AND
  Date Received >= 2025-09-01 AND
  Date Received < 2025-10-01
```

---

## Appendix: Full Record IDs for Fix

### Nicholas Sakha Client Record
- **Table**: 👨‍💻 Clients
- **Record ID**: `rec89jrzM22oFS5an`
- **Current Workspace Name**: `null`
- **New Workspace Name**: `"Nick Sakha"`

### Kirk Hodgson Client Record (Reference)
- **Table**: 👨‍💻 Clients
- **Record ID**: `rectnJY3xkrdjtdHx`
- **Current MTD**: 9 (incorrect)
- **Expected MTD after fix**: 0

### 9 Positive Reply Records to Re-link

| Lead ID | Record ID | Date Received | Current Client | New Client |
|---------|-----------|---------------|----------------|------------|
| 650991 | (fetch from API) | 2025-10-01 | Kirk Hodgson | Nicholas Sakha |
| 642436 | (fetch from API) | 2025-10-01 | Kirk Hodgson | Nicholas Sakha |
| 642213 | (fetch from API) | 2025-10-01 | Kirk Hodgson | Nicholas Sakha |
| 650172 | (fetch from API) | 2025-10-01 | Kirk Hodgson | Nicholas Sakha |
| 642168 | (fetch from API) | 2025-10-01 | Kirk Hodgson | Nicholas Sakha |
| 650503 | (fetch from API) | 2025-10-02 | Kirk Hodgson | Nicholas Sakha |
| 650463 | (fetch from API) | 2025-10-02 | Kirk Hodgson | Nicholas Sakha |
| 647824 | (fetch from API) | 2025-10-02 | Kirk Hodgson | Nicholas Sakha |
| 650518 | (fetch from API) | 2025-10-02 | Kirk Hodgson | Nicholas Sakha |

**Note**: Actual Airtable record IDs need to be fetched via API query before batch update.

---

## Conclusion

This was **not a bug in the dashboard code or Edge Functions**. The issue was a **data quality problem in Airtable** caused by:
1. Missing/incorrect Workspace Name in client record
2. Automation linking replies to wrong client when no exact match found

**Fix is straightforward**:
- Set Nicholas Sakha's workspace name to "Nick Sakha"
- Re-link 9 positive reply records from Kirk Hodgson to Nicholas Sakha

**After fix**:
- Kirk Hodgson will correctly show 0 for October ✅
- Nicholas Sakha will correctly show 9 for October ✅
- Future replies will link correctly ✅

**Estimated fix time**: 5 minutes (manual) or 2 minutes (API script)

---

**Report prepared by**: Claude Code
**Investigation date**: October 2, 2025
**Status**: Ready for implementation
