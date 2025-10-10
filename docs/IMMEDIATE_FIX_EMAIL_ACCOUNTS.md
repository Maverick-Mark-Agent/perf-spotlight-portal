# Immediate Fix for Duplicate Client Problem

## Current Situation

**Your Problem**: "I'm seeing 4 clients with the same email account count, but I know that's not true"

**Root Cause**: The `hybrid-email-accounts-v2` Edge Function returns data in real-time from Email Bison API, which times out and gives inconsistent results.

**Tables Created**: ✅ `email_accounts_raw` and `email_accounts_view` exist but are empty

**Sync Function**: ❌ Has bugs with workspace switching - needs more work

## Immediate Solution (10 minutes)

Instead of debugging the sync function, use the **existing working `hybrid-email-accounts-v2` function** ONE TIME to populate the tables, then switch the frontend to use the cached data.

### Step 1: One-Time Backfill (Use Hybrid Function)

Run this in your terminal:

```bash
# This will take 60-90 seconds but populate all 4,000+ accounts
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
  | jq -r '.records[] | {
      bison_account_id: .id,
      email_address: .fields["Email Account"],
      workspace_name: .fields.Workspace,
      status: .fields.Status,
      emails_sent_count: .fields["Total Sent"],
      price: .fields.Price
    }' \
  | jq -s '.' \
  > /tmp/email_accounts.json

# Convert to SQL INSERT statements
# (I'll create a script for this)
```

Actually, let me create a proper backfill script that uses the existing hybrid function:

**File**: `scripts/backfill-email-accounts-from-hybrid.sh`

```bash
#!/bin/bash

echo "🔄 Backfilling email_accounts_raw from hybrid-email-accounts-v2..."

# This uses the WORKING hybrid function to get all accounts
# Then inserts them into the new table structure

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0"

# Fetch from hybrid function
echo "Fetching accounts from hybrid function..."
ACCOUNTS=$(curl -s "$SUPABASE_URL/functions/v1/hybrid-email-accounts-v2" \
  -H "Authorization: Bearer $SUPABASE_KEY")

echo "Transforming and inserting..."

# Use Node.js to transform and insert (easier than jq for complex transformations)
node << 'EOF'
const data = require('fs').readFileSync(0, 'utf-8');
const parsed = JSON.parse(data);

const transformed = parsed.records.map(r => ({
  // Use a hash of email+workspace as bison_account_id since we don't have the real ID
  bison_account_id: Math.abs(hashCode(r.fields['Email Account'] + r.fields.Workspace)),
  email_address: r.fields['Email Account'],
  workspace_name: r.fields.Workspace,
  workspace_id: r.fields['Workspace ID'] || 0,
  bison_instance: r.fields['Bison Instance'] || 'maverick',
  status: r.fields.Status,
  account_type: r.fields['Account Type'],
  emails_sent_count: r.fields['Total Sent'] || 0,
  total_replied_count: r.fields['Total Replied'] || 0,
  unique_replied_count: r.fields['Unique Replied'] || 0,
  bounced_count: r.fields['Total Bounced'] || 0,
  unsubscribed_count: r.fields['Unsubscribed'] || 0,
  interested_leads_count: r.fields['Interested Leads'] || 0,
  daily_limit: r.fields['Daily Limit'] || 0,
  warmup_enabled: false,
  reply_rate_percentage: r.fields['Reply Rate Per Account %'] || 0,
  email_provider: r.fields['Tag - Email Provider'],
  reseller: r.fields['Tag - Reseller'],
  domain: r.fields.Domain,
  price: r.fields.Price || 0,
  price_source: 'calculated',
  pricing_needs_review: r.fields['Pricing Needs Review'] || false,
}));

console.log(JSON.stringify(transformed));

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
  }
  return hash;
}
EOF
```

This is getting complex. Let me give you the SIMPLEST solution that will work RIGHT NOW:
