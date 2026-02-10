# Tony Schmitz Webhook Fix - October 14, 2025

## ✅ COMPLETED ACTIONS

### What We Fixed

**Problem:** Webhook stopped working after deleting old webhook #86
**Root Cause:** Workspace-specific webhook was broken, needed fresh registration
**Solution:** Deleted and recreated webhook with clean slate

### Steps Executed

1. ✅ **Deleted webhook #113** - Cleared broken registration
2. ✅ **Waited 45 seconds** - Allowed Email Bison cache to clear
3. ✅ **Created webhook #114** - Fresh registration with correct URL
4. ✅ **Verified registration** - Confirmed webhook appears in Email Bison API
5. ✅ **Updated client_registry** - Database tracking updated

### New Webhook Configuration

**Webhook ID:** 114
**Name:** Tony Schmitz - Interested Lead Notifications
**URL:** `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook`
**Events:** `lead_interested`
**Created:** 2025-10-14T21:47:01Z
**Status:** Active and registered

## 🧪 TESTING INSTRUCTIONS

### How to Test

**IMPORTANT:** You must use a **BRAND NEW** lead that has NEVER been marked as interested before.

1. **Go to Email Bison** - Tony Schmitz workspace (ID 41)
2. **Find a fresh reply** - Look for a lead in "New" or "Replied" status that hasn't been categorized yet
3. **Mark as interested** - Click the "Interested" button/status for the FIRST time on this lead
4. **Monitor results** - Within 5 seconds, you should see:

### Expected Results

✅ **Webhook Delivery Log** (< 5 seconds)
```bash
npx tsx scripts/check-latest-webhook.ts
```
Should show new webhook entry with the lead's email

✅ **Database** (< 5 seconds)
```bash
VITE_SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co" \
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data } = await supabase.from('client_leads').select('lead_email, created_at').eq('workspace_name', 'Tony Schmitz').order('created_at', { ascending: false }).limit(1);
console.log('Latest lead:', data[0]);
"
```

✅ **Slack Notification** (< 10 seconds)
Check your Slack channel for the formatted lead notification with:
- Lead name and email
- Custom fields (address, renewal date, etc.)
- Reply preview (cleaned by OpenAI)
- "Respond" button linking to Email Bison

✅ **Client Portal** (immediately)
- Open Client Portal
- Navigate to Tony Schmitz
- Lead should appear in the dashboard

## 🔍 TROUBLESHOOTING

### If Webhook Still Doesn't Fire

**Check 1: Verify you're in the right workspace**
```bash
# Make sure you're marking leads in workspace ID 41
# URL should show: .../workspaces/41/...
```

**Check 2: Confirm it's a NEW lead**
```bash
VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." \
npx tsx scripts/check-lead-by-email.ts "lead@example.com"
```
If it says "Lead EXISTS", try a different lead.

**Check 3: Look for parent webhook interference**
The parent workspace (ID 2) has webhook #80 that might interfere.
If this is the issue, we'll need to implement Option 3 (add Slack to old function).

### If Webhook Fires But No Slack

**Check 1: Verify Slack webhook URL**
```bash
npx tsx scripts/test-slack-direct.ts
```
Should send test message to Slack.

**Check 2: Check for OpenAI errors**
View Supabase Edge Function logs:
- Go to Supabase Dashboard → Functions → universal-bison-webhook → Logs
- Look for OpenAI API errors

**Check 3: Verify client_registry**
```bash
VITE_SUPABASE_URL="..." VITE_SUPABASE_ANON_KEY="..." \
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data } = await supabase.from('client_registry').select('slack_webhook_url').eq('workspace_name', 'Tony Schmitz').single();
console.log('Slack URL configured:', !!data.slack_webhook_url);
"
```

## 🎯 FALLBACK PLANS

### If Option 2 Failed (Webhook #114 Not Firing)

**Next Step: Option 3 - Add Slack to Old Function**

The parent webhook #80 points to `bison-interested-webhook` function.
We can add Slack notification capability to that function instead.

**Steps:**
1. Update `supabase/functions/bison-interested-webhook/index.ts`
2. Add Slack notification code (copy from universal-bison-webhook)
3. Redeploy the function
4. All clients benefit (if desired), or add conditional logic for Tony only

### If All Options Fail

**Contact Email Bison Support**
There may be a bug or configuration issue in Email Bison's webhook system for workspace 41.

**Provide them with:**
- Workspace ID: 41
- Webhook ID: 114
- Issue: Webhooks not firing when leads marked as interested
- Timeline: Worked until Oct 14, stopped after deleting webhook #86

## 📊 WHAT WE LEARNED

### Email Bison Webhook Architecture

1. **Parent/Child Hierarchy**
   - Workspace 41 (Tony) is child of workspace 2 (Parent)
   - Parent has GLOBAL webhooks (#80, #68, #66)
   - Child-level webhooks may be overridden by parent

2. **Webhook Behavior**
   - Email Bison only sends `lead_interested` the FIRST time
   - Re-marking leads doesn't trigger webhooks
   - Testing requires fresh, new leads

3. **Multiple Webhook Systems**
   - n8n workflows (webhook #68)
   - Old Supabase function (webhook #80)
   - New Supabase function (webhook #114)
   - All can coexist but may conflict

## 📝 DOCUMENTATION UPDATES NEEDED

- [ ] Update webhook troubleshooting guide with parent/child info
- [ ] Document that re-marking leads doesn't trigger webhooks
- [ ] Add testing instructions for workspace-specific webhooks
- [ ] Create runbook for adding Slack to other clients

## ✨ SUCCESS METRICS

After successful test:
- ✅ Real-time lead notifications working
- ✅ Zero-delay database sync
- ✅ Slack notifications arriving
- ✅ Client Portal displaying leads immediately
- ✅ System ready for production use

---

**Status:** READY FOR TESTING
**Next Action:** Mark a fresh lead as interested and verify all systems
**Support Scripts:** All diagnostic scripts available in `/scripts/` directory
