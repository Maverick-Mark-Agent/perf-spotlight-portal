# Manual Fix Steps - Email Bison API Key Issue

Since the logs aren't showing complete diagnostic information, let's verify the API key manually.

## Step 1: Verify Your API Key Works

Run this command in your terminal, replacing `YOUR_API_KEY` with the actual API key you added to Supabase:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://send.maverickmarketingllc.com/api/workspaces/v1.1
```

### Expected Results:

**If the key is VALID:**
```json
{
  "data": [
    {"id": 123, "name": "Jason Binyon", ...},
    {"id": 456, "name": "Another Workspace", ...}
  ]
}
```
You should see a list of ~50 workspaces.

**If the key is INVALID:**
```json
{"error": "Unauthorized"}
```
Or HTTP 401 error.

---

## Step 2: Based on the Result

### If You Get Workspaces (Key is Valid):

The API key works! The issue might be:

1. **Check the secret name in Supabase** - Make sure it's exactly: `EMAIL_BISON_API_KEY` (case-sensitive, no spaces)

2. **Redeploy after confirming the secret:**
```bash
export SUPABASE_ACCESS_TOKEN=sbp_765c83453a7d30be808b30e47cc230e0e9686015
supabase functions deploy hybrid-email-accounts-v2 --project-ref gjqbbgrfhijescaouqkx
```

3. **Wait 30 seconds** for deployment to complete, then test:
```bash
node test-api.cjs
```

### If You Get 401 Unauthorized (Key is Invalid):

The API key you added to Supabase is not working. You need to:

1. Go to Email Bison: https://send.maverickmarketingllc.com/settings/api

2. **Generate a NEW API key** or find a different valid key

3. **Update in Supabase:**
   - Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/functions
   - Find `EMAIL_BISON_API_KEY`
   - Click Edit
   - Paste the NEW valid key
   - Click Save

4. **Redeploy:**
```bash
export SUPABASE_ACCESS_TOKEN=sbp_765c83453a7d30be808b30e47cc230e0e9686015
supabase functions deploy hybrid-email-accounts-v2 --project-ref gjqbbgrfhijescaouqkx
```

5. **Test:**
```bash
node test-api.cjs
```

---

## Step 3: Final Verification

When it's working, you should see:

```
Total Accounts: 4000+
Jason Binyon: 433 accounts
```

And your Infrastructure Dashboard will show accurate data!

---

## Need Help?

Tell me:
1. What did you see when you ran the curl command in Step 1?
2. Did you get workspaces or an error?

I'll help you fix it based on that!
