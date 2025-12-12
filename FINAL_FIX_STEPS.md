# Final Fix Steps - Update API Key Manually

The `supabase secrets set` command might not be updating the secret properly. Let's update it manually through the dashboard.

## Step 1: Delete ALL Old Bison Keys in Supabase

1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/functions

2. **Delete these old secrets** (if they exist):
   - BISON_API_KEY
   - MAVERICK-BISON-KEY
   - MAVERICK_BISON_API_KEY
   - Any other BISON-related keys

3. **Keep only these:**
   - EMAIL_BISON_API_KEY
   - LONG_RUN_BISON_API_KEY (if you use Long Run)
   - LONG_RUN_BISON_BASE_URL (if you use Long Run)

## Step 2: Update EMAIL_BISON_API_KEY

1. Find `EMAIL_BISON_API_KEY` in the list
2. Click **Edit** (pencil icon)
3. **Replace the value with:**
   ```
   101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b
   ```
4. Click **Save**

## Step 3: Redeploy

Run this command:
```bash
export SUPABASE_ACCESS_TOKEN=sbp_765c83453a7d30be808b30e47cc230e0e9686015
supabase functions deploy hybrid-email-accounts-v2 --project-ref gjqbbgrfhijescaouqkx
```

## Step 4: Test

Wait 10 seconds, then run:
```bash
node test-api.cjs
```

You should see:
```
Total Accounts: 1000+ (or whatever your actual count is)
Jason Binyon: 433 accounts (or close to it)
```

---

## If Still 0 Accounts

The issue might be that Supabase isn't picking up secret changes. Try this:

1. **Create a brand new secret with a different name:**
   - Go to Supabase secrets
   - Click "Add new secret"
   - Name: `EMAIL_BISON_API_KEY_NEW`
   - Value: `101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b`

2. **Update the Edge Function code** to use the new name:
   ```bash
   # Edit the file
   # Change line 18 from:
   const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');

   # To:
   const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY_NEW');
   ```

3. **Redeploy and test**

---

Let me know if this works!
