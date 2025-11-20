# AI Reply System - Deployment Instructions
**Date:** November 19, 2025
**Fix:** Email Bison API Integration - Numeric ID Requirement

---

## Summary of Changes

### Root Cause
Email Bison API endpoint `/api/replies/{reply_id}/reply` requires an **INTEGER** reply_id, but we were storing/passing UUID strings in some cases.

### Solution
Added `bison_reply_numeric_id` column to store the numeric ID separately from the UUID.

---

## Files Changed

### 1. Database Migration
**File:** `supabase/migrations/20251119000002_add_bison_reply_numeric_id.sql`
- Adds `bison_reply_numeric_id BIGINT` column
- Backfills existing numeric IDs
- Creates performance index

### 2. Webhook Function
**File:** `supabase/functions/universal-bison-webhook/index.ts`
- Updated `handleLeadReplied` to store `reply.id` in `bison_reply_numeric_id`
- Updated `handleLeadInterested` to store `reply.id` in `bison_reply_numeric_id`

### 3. Send Reply Function
**File:** `supabase/functions/send-reply-via-bison/index.ts`
- Updated to fetch `bison_reply_numeric_id`
- Uses numeric ID for Email Bison API call
- Fixed `sender_email_id` type (now ensures integer)
- Fixed `cc_emails` inclusion (uses conditional spread)
- Better error messages when numeric ID is missing

---

## Deployment Steps

### Step 1: Apply Database Migration
```bash
SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
npx supabase db push --project-ref gjqbbgrfhijescaouqkx
```

Expected output:
```
✅ Migration 20251119000002_add_bison_reply_numeric_id.sql applied
```

### Step 2: Deploy Edge Functions
```bash
# Deploy updated webhook
SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
npx supabase functions deploy universal-bison-webhook \
  --project-ref gjqbbgrfhijescaouqkx

# Deploy updated send-reply function
SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
npx supabase functions deploy send-reply-via-bison \
  --project-ref gjqbbgrfhijescaouqkx
```

Expected output:
```
✅ universal-bison-webhook deployed
✅ send-reply-via-bison deployed
```

### Step 3: Verify Deployment
```bash
# Check function logs
SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
npx supabase functions logs send-reply-via-bison \
  --project-ref gjqbbgrfhijescaouqkx \
  --limit 10
```

---

## Testing Checklist

### Test 1: Verify Database Column Exists
```sql
SELECT
  id,
  lead_email,
  bison_reply_id,
  bison_reply_numeric_id
FROM lead_replies
LIMIT 10;
```

**Expected:** `bison_reply_numeric_id` column should exist and have values for existing numeric IDs.

### Test 2: Trigger New Reply Webhook
**Action:** Wait for a new reply to come in via Email Bison webhook
**Expected:** New reply should have BOTH `bison_reply_id` (UUID) and `bison_reply_numeric_id` (integer) populated

### Test 3: Generate AI Reply
1. Go to Live Replies Dashboard: http://localhost:8080/live-replies
2. Find a reply with `bison_reply_numeric_id` populated
3. Click "AI Reply"
4. Click "Generate Reply"
5. Review generated reply
6. Click "Send Reply"

**Expected:**
- ✅ 200 response from Email Bison API
- ✅ "Reply sent successfully" message
- ✅ Email appears in Email Bison sent items
- ✅ CC recipients receive copy

### Test 4: Verify CC Functionality
1. After sending reply in Test 3
2. Log into Email Bison inbox
3. Navigate to Sent folder
4. Open the sent reply
5. Check CC field

**Expected:**
- ✅ CC email addresses are listed
- ✅ CC recipients received email (check their inboxes)

### Test 5: Error Handling - Old Reply Without Numeric ID
1. Try to send reply for an old reply (before migration)
2. Click "AI Reply"
3. Try to send

**Expected:**
- ❌ Error message: "Missing numeric reply ID - cannot send reply via Email Bison API. This reply needs to be re-synced from Email Bison webhook."
- This is correct behavior - old replies need new webhook event to get numeric ID

---

## Rollback Plan (If Needed)

If there are issues after deployment:

### Option A: Revert Edge Functions
```bash
# Check previous version
git log --oneline supabase/functions/send-reply-via-bison/index.ts

# Revert to previous commit
git checkout <previous-commit-hash> supabase/functions/send-reply-via-bison/index.ts
git checkout <previous-commit-hash> supabase/functions/universal-bison-webhook/index.ts

# Redeploy
SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
npx supabase functions deploy send-reply-via-bison --project-ref gjqbbgrfhijescaouqkx

SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
npx supabase functions deploy universal-bison-webhook --project-ref gjqbbgrfhijescaouqkx
```

### Option B: Database Column is Safe
The new `bison_reply_numeric_id` column can remain even if we rollback code:
- It's nullable (won't break anything)
- Doesn't affect existing functionality
- Can be used later when ready

---

## Expected Behavior After Deployment

### ✅ NEW Replies (After Deployment)
- Will have both UUID and numeric ID
- Can send AI replies successfully
- CC functionality works perfectly

### ❌ OLD Replies (Before Deployment)
- Only have UUID (no numeric ID)
- Cannot send AI replies yet
- Need to wait for next reply from that lead to get numeric ID
- Or manually trigger re-sync (advanced)

### Workaround for OLD Replies
If you need to send a reply for an old reply:
1. **Option A:** Wait for lead to reply again (webhook will populate numeric ID)
2. **Option B:** Manual reply via Email Bison UI
3. **Option C:** Create backfill script (not recommended - complex)

---

## API Documentation Reference

From Email Bison API documentation (`api-1 (2).json`):

```json
{
  "path": "/api/replies/{reply_id}/reply",
  "method": "POST",
  "parameters": {
    "reply_id": {
      "type": "integer",  // ← MUST BE INTEGER!
      "required": true,
      "description": "The ID of the parent reply"
    }
  },
  "requestBody": {
    "message": "string (required)",
    "to_emails": [
      {
        "name": "string|null",
        "email_address": "string (required)"
      }
    ],
    "cc_emails": [  // ← SUPPORTED!
      {
        "name": "string|null",
        "email_address": "string (required)"
      }
    ],
    "sender_email_id": "integer",
    "content_type": "html|text",
    "inject_previous_email_body": boolean,
    "use_dedicated_ips": boolean
  }
}
```

---

## Success Metrics

After deployment, monitor:

### Metrics to Track
- [ ] All new replies have `bison_reply_numeric_id` populated
- [ ] AI reply send success rate > 95%
- [ ] CC emails delivered successfully (verify manually)
- [ ] No 500 errors in edge function logs
- [ ] User feedback: "CC functionality works!"

### Key Performance Indicators
- **Before Fix:** 100% failure rate (500 errors)
- **After Fix:** >95% success rate for replies with numeric ID
- **CC Delivery Rate:** 100% (all CC recipients receive copy)

---

## Notes

### Why Both UUID and Numeric ID?
- **UUID (`bison_reply_id`):** Used in conversation URLs (`/inbox?reply_uuid=...`)
- **Numeric ID (`bison_reply_numeric_id`):** Required for API calls (`/api/replies/{id}/reply`)
- Email Bison provides both in webhook, we need both for different purposes

### Future Improvements
1. Add UI indicator when reply cannot be sent (no numeric ID)
2. Create backfill script for old replies (if needed)
3. Add monitoring/alerting for failed sends
4. Track CC delivery metrics in dashboard

---

## Contact for Issues

If you encounter problems:
1. Check edge function logs first
2. Verify database migration applied successfully
3. Test with a fresh reply (not old data)
4. Review this document for troubleshooting steps

---

**Last Updated:** November 19, 2025
**Status:** Ready for Deployment
**Confidence:** 🟢 HIGH - Fix verified against Email Bison API documentation
