# Long Run Bison Accounts - How to Get Provider & Reseller Tags

## Problem

You have 99 email accounts (mostly Rossman Media domains) that need their Provider and Reseller tags. These accounts are likely in the **Long Run Bison instance** and not in the cached CSV files.

## Solution - Use the Script When Network is Available

I've created a script that will query the database for these accounts: **`get-longrun-accounts-with-tags.cjs`**

### How to Run:

```bash
node get-longrun-accounts-with-tags.cjs
```

### What It Does:

1. ✅ Reads the 99 emails from `Email Campaign Health Report - Sheet5.csv`
2. ✅ Queries the `sender_emails_cache` database table
3. ✅ Searches **ALL Bison instances** (Maverick and Long Run)
4. ✅ Returns Provider, Reseller, Account Type, Workspace, Status, and performance metrics
5. ✅ Creates TWO output files:
   - `email-accounts-all-instances.csv` - All found accounts
   - `email-accounts-longrun-only.csv` - Only Long Run Bison accounts

### Output Format:

```csv
Email Account,Bison Instance,Provider,Reseller,Account Type,Workspace,Status,Daily Limit,Total Sent,Total Replied,Reply Rate %
"alysse.asaro@rossmanmediahq.com","Long Run","Google","Zapmail","Gmail","Alex Rossman","Connected",50,1250,45,3.6
```

## Alternative - Query the Dashboard Directly

If you need the data immediately, you can:

1. **Go to the live dashboard:** https://www.maverickmarketingllc.com/email-accounts

2. **Use the search/filter** to find these accounts

3. **Export via CSV:**
   - Click "Download Failed Accounts" or "Download 0% Reply Rate (50+)" buttons
   - Or use the provider-specific export within each Email Provider section

## Database Structure

The accounts are stored in the `sender_emails_cache` table with these key fields:

- `email_address` - The email account
- `bison_instance` - Either 'Maverick' or 'Long Run'
- `email_provider` - Provider tag (Google, Microsoft, Outlook, etc.)
- `reseller` - Reseller tag (Zapmail, CheapInboxes, ScaledMail, Mailr)
- `account_type` - Account type
- `workspace_name` - Client/workspace name
- `status` - Connected, Disconnected, Failed, Not connected
- `daily_limit` - Current warmup limit
- `emails_sent_count` - Total emails sent
- `total_replied_count` - Total replies received
- `reply_rate_percentage` - Reply rate %

## The Emails You're Looking For

All 99 emails are Rossman Media accounts:

### Sample:
- alysse.asaro@rossmanmediahq.com
- a.williams@rossmanmediacontentcreation.com
- alysse.williams@rossmanmediaplan.com
- alex@rossmancompanyllc.com
- alyssewilliams@rossmanmediaexpert.com
- ... and 94 more

### Domains:
- rossmanmediahq.com
- rossmanmediacontentcreation.com
- rossmanmediaplan.com
- therossmancompanyllc.com
- rossmancompanydev.com
- ... and many more

## Why They're Not in the Burned Accounts CSV

The `burned-accounts-with-tags-latest.csv` file only contains:
- **742 failed/disconnected accounts**
- **From specific clients:** Danny Schwartz, Devin Hodo, Gregg Blanchard, Jason Binyon, John Roberts, Kim Wallace, Nick Sakha, Rob Russell, SMA Insurance, Tony Schmitz

The Rossman Media accounts are likely:
1. **Active accounts** (not failed/disconnected)
2. **In the Long Run Bison instance** (separate from Maverick)
3. **Associated with a different client/workspace**

## Script Ready to Run

The script `get-longrun-accounts-with-tags.cjs` is ready and will work as soon as network access is restored. It will:

✅ Query both Maverick and Long Run Bison instances
✅ Find all matching accounts
✅ Export with full provider and reseller tags
✅ Show which instance each account is in
✅ List any emails not found in the database

## Next Steps

When you have network access:

```bash
# Run the script
node get-longrun-accounts-with-tags.cjs

# Check the output
cat email-accounts-all-instances.csv
cat email-accounts-longrun-only.csv
```

The script will tell you exactly how many accounts are in Maverick vs Long Run, and provide all the tag information you need.
