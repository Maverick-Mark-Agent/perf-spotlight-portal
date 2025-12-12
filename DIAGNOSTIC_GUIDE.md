# 🔍 Infrastructure Dashboard - Diagnostic Guide

## Current Status

The Edge Function has been **deployed with enhanced diagnostic logging** to help identify why it's returning 0 accounts.

---

## ✅ What I've Done

1. **Added comprehensive diagnostic logging** to `hybrid-email-accounts-v2` Edge Function:
   - Logs environment variable presence/absence
   - Logs API key length (without exposing the key)
   - Logs detailed HTTP response codes from Email Bison API
   - Logs error messages from failed API calls
   - Logs workspace fetch attempts

2. **Successfully redeployed** the function with new logging

3. **Confirmed function still returns 0 accounts** after deployment

---

## 📋 How to Check Logs (MANUAL STEP REQUIRED)

### Option 1: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/hybrid-email-accounts-v2/logs

2. Click **"Refresh"** or wait for new logs to appear

3. Look for these diagnostic messages:

#### ✅ If EMAIL_BISON_API_KEY exists, you'll see:
```
🔍 [DIAGNOSTIC] Starting Edge Function execution...
🔍 [DIAGNOSTIC] Environment variables check:
  - EMAIL_BISON_API_KEY: ✅ Present (length: 150)
  - SUPABASE_URL: ✅ Present
  - SUPABASE_SERVICE_ROLE_KEY: ✅ Present
🔍 [Maverick] Fetching workspaces from Maverick Email Bison...
🔍 [Maverick] API URL: https://send.maverickmarketingllc.com/api/workspaces/v1.1
🔍 [Maverick] Workspaces API response status: 200
✅ [Maverick] Fetched 50 workspaces from Maverick
```

#### ❌ If EMAIL_BISON_API_KEY is missing, you'll see:
```
🔍 [DIAGNOSTIC] Starting Edge Function execution...
🔍 [DIAGNOSTIC] Environment variables check:
  - EMAIL_BISON_API_KEY: ❌ MISSING
  - SUPABASE_URL: ✅ Present
  - SUPABASE_SERVICE_ROLE_KEY: ✅ Present
❌ EMAIL_BISON_API_KEY environment variable is not set in Supabase Edge Functions
```

#### ❌ If API key is invalid/expired, you'll see:
```
🔍 [Maverick] Workspaces API response status: 401
❌ [Maverick] Email Bison API error: 401
❌ [Maverick] Response body: {"error":"Unauthorized"}
```

#### ❌ If API key lacks permissions, you'll see:
```
🔍 [Maverick] Workspaces API response status: 403
❌ [Maverick] Email Bison API error: 403
❌ [Maverick] Response body: {"error":"Forbidden"}
```

### Option 2: Test Function

Run this command to test and see basic diagnostic output:

```bash
node test-edge-function-diagnostic.js
```

This will tell you if the function is returning data, but won't show you the detailed logs.

---

## 🔧 How to Fix Based on Logs

### Scenario 1: EMAIL_BISON_API_KEY is Missing

**Symptoms in logs:**
- `❌ MISSING` next to EMAIL_BISON_API_KEY

**Fix:**

1. Get your Email Bison API key:
   - Go to: https://send.maverickmarketingllc.com
   - Login → Settings → API Keys
   - Copy your API key

2. Add to Supabase:
   - Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/functions
   - Click **"Add new secret"**
   - Name: `EMAIL_BISON_API_KEY`
   - Value: [Paste API key]
   - Click **"Save"**

3. Redeploy (no code changes needed):
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_765c83453a7d30be808b30e47cc230e0e9686015
   supabase functions deploy hybrid-email-accounts-v2 --project-ref gjqbbgrfhijescaouqkx
   ```

### Scenario 2: API Key is Invalid/Expired (HTTP 401)

**Symptoms in logs:**
- `✅ Present` next to EMAIL_BISON_API_KEY
- `❌ [Maverick] Email Bison API error: 401`
- Response body shows "Unauthorized"

**Fix:**

1. Get a **fresh** API key from Email Bison (same steps as above)

2. **Update** the existing secret in Supabase:
   - Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/functions
   - Find `EMAIL_BISON_API_KEY` in the list
   - Click **"Edit"**
   - Paste new value
   - Click **"Save"**

3. Redeploy function (same command as above)

### Scenario 3: API Key Lacks Permissions (HTTP 403)

**Symptoms in logs:**
- `✅ Present` next to EMAIL_BISON_API_KEY
- `❌ [Maverick] Email Bison API error: 403`
- Response body shows "Forbidden"

**Fix:**

1. Check API key permissions in Email Bison:
   - Go to: https://send.maverickmarketingllc.com/settings/api
   - Make sure the API key has permissions to:
     - List workspaces
     - Access sender emails
     - Switch workspaces

2. If permissions are restricted, create a **new API key** with full access

3. Update in Supabase (same steps as Scenario 2)

### Scenario 4: API Key Works but Returns 0 Workspaces

**Symptoms in logs:**
- `✅ Present` next to EMAIL_BISON_API_KEY
- `🔍 [Maverick] Workspaces API response status: 200`
- `✅ [Maverick] Fetched 0 workspaces from Maverick`

**Fix:**

This means the API key is valid but the account has no workspaces. This is likely a **wrong account**:

1. Log in to: https://send.maverickmarketingllc.com
2. Confirm you're in the **correct account** (should show ~50 workspaces)
3. If you're in the wrong account, get API key from the correct account
4. Update in Supabase (same steps as Scenario 2)

---

## 🧪 Verify the Fix

After updating the API key and redeploying, test it:

```bash
node test-api.cjs
```

**Expected Output:**
```
Total Accounts: 4000+
Jason Binyon: 433 accounts
```

---

## 📊 What the Logs Should Show When Working

When everything is working correctly, logs should show:

```
🔍 [DIAGNOSTIC] Starting Edge Function execution...
🔍 [DIAGNOSTIC] Environment variables check:
  - EMAIL_BISON_API_KEY: ✅ Present (length: 150)
  - SUPABASE_URL: ✅ Present
  - SUPABASE_SERVICE_ROLE_KEY: ✅ Present

🔍 [Maverick] Fetching workspaces from Maverick Email Bison...
🔍 [Maverick] API URL: https://send.maverickmarketingllc.com/api/workspaces/v1.1
🔍 [Maverick] Workspaces API response status: 200
✅ [Maverick] Fetched 50 workspaces from Maverick

[Maverick] Switching to workspace: Jason Binyon (ID: 123)
📄 [Maverick] Jason Binyon: Page 1/29 - 15 accounts (Total: 15)
📄 [Maverick] Jason Binyon: Page 2/29 - 15 accounts (Total: 30)
...
✅ [Maverick] Jason Binyon: Fetched 433 accounts across 29 pages

========================================
📊 SYNC SUMMARY
========================================
Total Email Bison Instances: 1
Total Sender Emails Fetched: 4123
  - Maverick: 4123 accounts
Top 5 Workspaces by Account Count:
  - Jason Binyon: 433 accounts
  - Other Workspace: 250 accounts
  ...
========================================
```

---

## 🆘 If You're Still Stuck

**Please check the logs and tell me:**

1. Is `EMAIL_BISON_API_KEY` showing as `✅ Present` or `❌ MISSING`?
2. If present, what HTTP status code is the Email Bison API returning? (200, 401, 403, etc.)
3. What is the error message in the logs?
4. How many workspaces were fetched? (should be ~50)

With this information, I can provide a specific fix!

---

## 📝 Summary

**STATUS:** Edge Function deployed with diagnostic logging ✅

**NEXT STEP:** Check the logs in Supabase Dashboard to identify the specific error

**LOGS URL:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/hybrid-email-accounts-v2/logs

Once you identify the error from the logs, follow the appropriate fix scenario above.
