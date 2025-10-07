# Infrastructure Dashboard: Airtable to Supabase Migration Analysis

## Current State Analysis

### Data Sources
The `hybrid-email-accounts` function currently pulls from:

1. **Email Bison API** (Primary - Real-time metrics)
2. **Airtable "Email Accounts" table** (Secondary - Metadata only)

### What Email Bison Provides (Lines 164-214)
✅ **Already available - NO migration needed:**
- Email account address
- Account name
- Status (connected/disconnected)
- Daily limit
- Total sent, replied, bounced, opened counts
- Unique reply/open counts
- Total leads contacted
- Interested leads count
- Unsubscribed count
- Account type (Gmail, Microsoft, etc.)
- Reply rate (calculated)
- Workspace name & ID
- Tags (provider, reseller, custom)
- Created/Updated timestamps

### What Airtable Provides (Lines 196-203)
⚠️ **Needs migration to Supabase:**
1. **Price** - Account pricing/cost
2. **Tag - Email Provider** - Email provider (Gmail, Microsoft, etc.) - *Can use Email Bison tags instead*
3. **Tag - Reseller** - Reseller (Instantly, Smartlead, etc.) - *Can use Email Bison tags instead*
4. **Client** - Linked client records
5. **Client Name (from Client)** - Client name lookup
6. **Domain** - Email domain - *Can extract from email address*
7. **Volume Per Account** - Volume target - *Already have daily_limit from Email Bison*
8. **Clients Daily Volume Target** - Client-level volume target

### Critical Fields to Migrate

Only **2 fields** truly need Supabase:

1. **Price** (Number)
   - Current: Pulled from Airtable
   - Usage: Cost analysis, pricing charts
   - Migration: Create `email_account_metadata` table in Supabase

2. **Client Association** (Relationship)
   - Current: Airtable linked records
   - Usage: Filtering by client, client-specific views
   - Migration: Use workspace_name to map to clients table

### Fields That Can Be Removed (Already in Email Bison)

1. ✅ **Tag - Email Provider** - Use Email Bison tags
2. ✅ **Tag - Reseller** - Use Email Bison tags
3. ✅ **Domain** - Extract from email address
4. ✅ **Volume Per Account** - Use `daily_limit` from Email Bison
5. ✅ **Client Name** - Use workspace_name from Email Bison

## Migration Plan

### Phase 1: Create Supabase Schema

#### Table: `email_account_metadata`
```sql
create table public.email_account_metadata (
  id uuid default uuid_generate_v4() primary key,
  email_address text not null unique,
  price decimal(10,2) default 0,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add index on email_address for fast lookups
create index idx_email_account_metadata_email on public.email_account_metadata(email_address);

-- Enable Row Level Security
alter table public.email_account_metadata enable row level security;

-- Allow all operations for now (adjust based on your auth requirements)
create policy "Allow all operations"
  on public.email_account_metadata
  for all
  using (true)
  with check (true);
```

### Phase 2: Migrate Existing Airtable Data to Supabase

#### Migration Script
```javascript
// Run this once to migrate existing price data from Airtable to Supabase

const migrateEmailAccountPricing = async () => {
  // 1. Fetch all records from Airtable
  const airtableRecords = await fetchAllAirtableEmailAccounts();

  // 2. Transform and insert into Supabase
  const recordsToInsert = airtableRecords
    .filter(r => r.fields['Email Account'] && r.fields['Price'])
    .map(r => ({
      email_address: r.fields['Email Account'].toLowerCase(),
      price: r.fields['Price'] || 0,
      notes: r.fields['Notes'] || null
    }));

  // 3. Upsert into Supabase (on conflict, update price)
  const { data, error } = await supabase
    .from('email_account_metadata')
    .upsert(recordsToInsert, {
      onConflict: 'email_address',
      ignoreDuplicates: false
    });

  console.log(`Migrated ${recordsToInsert.length} email account prices`);
};
```

### Phase 3: Update `hybrid-email-accounts` Function

Replace Airtable fetch with Supabase:

```typescript
// OLD: Fetch from Airtable (lines 119-161)
// NEW: Fetch from Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fetch metadata from Supabase instead of Airtable
console.log('Fetching email account metadata from Supabase...');

const { data: metadataRecords, error } = await supabase
  .from('email_account_metadata')
  .select('*');

if (error) {
  console.error('Supabase error:', error);
}

const metadataMap = new Map();
(metadataRecords || []).forEach(record => {
  metadataMap.set(record.email_address.toLowerCase(), record);
});

// Merge Email Bison data with Supabase metadata
const mergedRecords = senderEmails.map((bisonEmail: any) => {
  const metadata = metadataMap.get(bisonEmail.email.toLowerCase()) || {};

  // Extract provider and reseller from Email Bison tags (no Airtable needed)
  const emailProvider = extractProviderFromTags(bisonEmail.tags);
  const reseller = extractResellerFromTags(bisonEmail.tags);
  const domain = bisonEmail.email.split('@')[1] || '';

  return {
    id: bisonEmail.id,
    fields: {
      // Email Bison data (real-time metrics)
      'Email Account': bisonEmail.email,
      'Name': bisonEmail.name,
      'Status': bisonEmail.status,
      'Daily Limit': bisonEmail.daily_limit,
      'Total Sent': bisonEmail.emails_sent_count,
      'Total Replied': bisonEmail.total_replied_count,
      'Total Bounced': bisonEmail.bounced_count,
      'Interested Leads': bisonEmail.interested_leads_count,
      'Account Type': bisonEmail.type,
      'Reply Rate Per Account %': bisonEmail.emails_sent_count > 0
        ? (bisonEmail.unique_replied_count / bisonEmail.emails_sent_count) * 100
        : 0,

      // Workspace info (from Email Bison)
      'Workspace': bisonEmail.workspace_name,
      'Workspace ID': bisonEmail.workspace_id,
      'Client': bisonEmail.workspace_name, // Use workspace as client

      // Extracted from Email Bison (no Airtable needed)
      'Tag - Email Provider': emailProvider,
      'Tag - Reseller': reseller,
      'Domain': domain,
      'Tags': bisonEmail.tags.map((tag: any) => tag.name),

      // Supabase metadata
      'Price': metadata.price || 0,

      // Timestamps
      'Created At': bisonEmail.created_at,
      'Updated At': bisonEmail.updated_at,
    }
  };
});
```

### Phase 4: Remove Airtable Dependency

After migration is complete and verified:

1. Remove `AIRTABLE_API_KEY` from function
2. Remove Airtable fetch code (lines 119-161)
3. Update function to only use Email Bison + Supabase

## Implementation Steps

### Step 1: Create Migration Script
Create `supabase/functions/migrate-email-account-pricing/index.ts`:
- One-time data migration from Airtable to Supabase
- Fetches all Airtable email account records
- Inserts price data into Supabase

### Step 2: Run Migration
```bash
supabase functions deploy migrate-email-account-pricing
curl -X POST [function-url] # Run once to migrate data
```

### Step 3: Update Main Function
Modify `hybrid-email-accounts/index.ts`:
- Replace Airtable with Supabase lookup
- Remove Airtable API key dependency
- Test with sample accounts

### Step 4: Verify Data
- Check all accounts have prices in Supabase
- Verify dashboard displays correctly
- Compare with Airtable data for accuracy

### Step 5: Deploy & Monitor
```bash
supabase functions deploy hybrid-email-accounts
```
- Monitor function logs
- Check dashboard for missing data
- Fix any issues

### Step 6: Cleanup
- Archive Airtable "Email Accounts" table
- Remove `AIRTABLE_API_KEY` from Supabase secrets
- Update documentation

## Data That's Already Correct (No Migration Needed)

The following is already sourced from Email Bison:
- ✅ All email metrics (sent, replied, bounced, opened)
- ✅ Account status
- ✅ Daily limits
- ✅ Account type
- ✅ Workspace associations
- ✅ Tags (provider, reseller)
- ✅ Timestamps

## Benefits of Migration

1. **Single Source of Truth** - Email Bison for metrics, Supabase for metadata
2. **No Airtable Dependency** - One less external service
3. **Better Performance** - Direct database queries vs API calls
4. **Easier Maintenance** - Standard database operations
5. **Cost Reduction** - Remove Airtable subscription (if applicable)
6. **Real-time Updates** - Can update prices directly in Supabase

## Rollback Plan

If issues occur:
1. Keep old function version as `index-airtable.ts`
2. Can redeploy old version anytime
3. Supabase data won't conflict with Airtable

## Questions to Answer Before Migration

1. ✅ Do we need price data? **YES** - Used in cost analysis
2. ✅ Can we use Email Bison tags instead of Airtable tags? **YES**
3. ✅ Can we map clients via workspace name? **YES**
4. ⚠️ Are there any custom fields in Airtable we're missing? **Need to verify**
5. ⚠️ Do we need to maintain Airtable for other purposes? **TBD**

## Estimated Impact

- **Data to migrate**: ~500-1000 email account price records
- **Migration time**: ~5 minutes
- **Development time**: 2-3 hours
- **Testing time**: 1 hour
- **Risk level**: LOW (only migrating price field, all metrics stay in Email Bison)

## Success Criteria

✅ All email accounts display in dashboard
✅ Price data shows correctly in charts
✅ No data loss during migration
✅ Dashboard performance is same or better
✅ Can update prices directly in Supabase (optional UI)

---

**Ready to proceed?** This is a minimal migration - we're only moving the `Price` field to Supabase. Everything else is already in Email Bison or can be derived from it.
