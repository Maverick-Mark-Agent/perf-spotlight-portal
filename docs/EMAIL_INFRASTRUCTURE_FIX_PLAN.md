# Email Infrastructure Dashboard Fix Plan

**Date**: October 9, 2025
**Purpose**: Fix critical issues with real-time email infrastructure migration
**Priority**: 🔴 CRITICAL (blocking production use)

---

## 🚨 Critical Issues Identified

### Issue 1: Only 1,046 Accounts Showing (Expected: 4000+)
**Current**: sender_emails_cache table has 1,046 records
**Expected**: 4000+ records from BOTH Maverick AND Long Run instances
**Root Cause**: Only Long Run Bison accounts are being synced (poll-sender-emails function issue)

### Issue 2: Missing Maverick Bison Accounts
**Current**: All 1,046 records show `bison_instance: "Long Run"`
**Expected**: ~2,600 Maverick + ~1,400 Long Run = 4,000+ total
**Evidence**:
- Client registry shows 16 Maverick workspaces + 8 Long Run workspaces
- Only seeing Long Run accounts in sender_emails_cache

### Issue 3: Missing Pricing Calculations
**Current**: sender_emails_cache has no price field
**Expected**: Calculated pricing based on provider + reseller with complex domain-based rules
**Impact**: Dashboard cards showing $0 total cost instead of actual cost

### Issue 4: Missing Reply Rate Calculated Column
**Current**: sender_emails_cache has `reply_rate_percentage` as generated column
**Status**: ✅ EXISTS (verified in schema) - may just need frontend update

### Issue 5: Dashboard Cards Not Rendering Correctly
**Current**: Frontend may be looking for wrong field names after migration
**Expected**: All dashboard stat cards should show correct aggregated data

---

## 📊 Data Analysis

### Current State:
```sql
-- Actual data in sender_emails_cache
SELECT
  bison_instance,
  COUNT(*) as account_count,
  COUNT(DISTINCT workspace_name) as workspace_count
FROM sender_emails_cache
GROUP BY bison_instance;

Result:
bison_instance | account_count | workspace_count
Long Run       | 1,046         | 8
-- MISSING: Maverick accounts entirely
```

### Expected State (from old Edge Function):
- **Maverick**: ~2,600 accounts across 16 workspaces
- **Long Run**: ~1,400 accounts across 8 workspaces
- **Total**: 4,000+ accounts across 24 workspaces

### Pricing Logic (from hybrid-email-accounts-v2):

#### Reseller-Based Pricing:
| Reseller | Rule | Price |
|----------|------|-------|
| **CheapInboxes** | All accounts | **$3.00** per account |
| **Zapmail** | All accounts | **$3.00** per account |
| **Mailr** | Flat rate divided | **$0.91** per account ($180 total / 198 accounts) |
| **ScaledMail** | Domain-based | **$50 per domain** ÷ mailboxes on domain |

#### Daily Sending Limits:
| Provider/Reseller | Rule | Daily Limit |
|-------------------|------|-------------|
| **Mailr** | Domain-based | **495 emails/domain** ÷ mailboxes on domain |
| **ScaledMail (49-50 mailboxes)** | Large domains | **5 emails/day** per mailbox |
| **ScaledMail (25-48 mailboxes)** | Medium domains | **8 emails/day** per mailbox |
| **ScaledMail (< 25 mailboxes)** | Small domains | **5 emails/day** per mailbox |
| **Gmail / Google** | Standard | **20 emails/day** |
| **Microsoft / Outlook** | Standard | **20 emails/day** |

---

## 🔧 Fix Plan (Step-by-Step)

### Phase 1: Fix poll-sender-emails Function (Sync ALL Accounts)

**Goal**: Ensure BOTH Maverick AND Long Run accounts are synced

**Steps**:

#### 1.1 Investigate Current Poll Function
```bash
# Check which API keys are set
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase secrets list
```

**Verify**:
- ✅ `MAVERICK_BISON_API_KEY` is set
- ✅ `LONG_RUN_BISON_API_KEY` is set
- ✅ Both are correct and active

#### 1.2 Test Poll Function Manually
```bash
# Invoke poll function manually to see output
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Output**:
```json
{
  "success": true,
  "total_workspaces": 24,
  "total_accounts_synced": 4000+,
  "results": [
    { "workspace": "John Roberts", "instance": "Maverick", "accounts_synced": 120 },
    { "workspace": "Kim Wallace", "instance": "Long Run", "accounts_synced": 85 },
    ...
  ]
}
```

#### 1.3 Check pg_cron Job Status
```bash
# Verify cron job is running
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/rpc/check_cron_jobs" \
  -H "apikey: $SUPABASE_KEY"
```

**Action**: If cron job isn't running every 5 minutes, investigate why

---

### Phase 2: Add Pricing Calculations to Database

**Goal**: Add price and daily_limit fields with calculated values

#### 2.1 Update sender_emails_cache Schema
```sql
-- Add missing columns
ALTER TABLE public.sender_emails_cache
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_source TEXT DEFAULT 'calculated',
ADD COLUMN IF NOT EXISTS pricing_needs_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_limit_calculated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sending_limit_source TEXT DEFAULT 'calculated',
ADD COLUMN IF NOT EXISTS sending_limit_needs_review BOOLEAN DEFAULT false;

-- Add domain count tracking for ScaledMail/Mailr pricing
CREATE TABLE IF NOT EXISTS public.domain_mailbox_counts (
  domain TEXT PRIMARY KEY,
  reseller TEXT NOT NULL,
  mailbox_count INTEGER NOT NULL,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_domain_mailbox_counts_reseller
ON public.domain_mailbox_counts(reseller, domain);
```

#### 2.2 Create Pricing Calculation Function
```sql
-- Supabase function to calculate price based on reseller + provider + domain
CREATE OR REPLACE FUNCTION public.calculate_email_account_price(
  p_reseller TEXT,
  p_email_provider TEXT,
  p_domain TEXT,
  p_account_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $
DECLARE
  v_price DECIMAL(10,2);
  v_needs_review BOOLEAN;
  v_mailbox_count INTEGER;
BEGIN
  -- CheapInboxes: $3.00 for all
  IF LOWER(p_reseller) LIKE '%cheapinboxes%' THEN
    RETURN jsonb_build_object('price', 3.00, 'needs_review', false, 'source', 'CheapInboxes flat rate');
  END IF;

  -- Zapmail: $3.00 for all
  IF LOWER(p_reseller) = 'zapmail' THEN
    RETURN jsonb_build_object('price', 3.00, 'needs_review', false, 'source', 'Zapmail flat rate');
  END IF;

  -- Mailr: $0.91 per account ($180 / 198 accounts)
  IF LOWER(p_reseller) = 'mailr' THEN
    RETURN jsonb_build_object('price', 0.91, 'needs_review', false, 'source', 'Mailr flat rate');
  END IF;

  -- ScaledMail: $50 per domain ÷ mailboxes on domain
  IF LOWER(p_reseller) = 'scaledmail' THEN
    SELECT mailbox_count INTO v_mailbox_count
    FROM public.domain_mailbox_counts
    WHERE reseller = 'scaledmail' AND domain = p_domain;

    IF v_mailbox_count IS NOT NULL AND v_mailbox_count > 0 THEN
      v_price := ROUND(50.0 / v_mailbox_count, 2);
      RETURN jsonb_build_object('price', v_price, 'needs_review', false, 'source', 'ScaledMail domain-based');
    ELSE
      RETURN jsonb_build_object('price', 0, 'needs_review', true, 'source', 'ScaledMail - domain count missing');
    END IF;
  END IF;

  -- Google accounts with health tags: $3.00
  IF LOWER(p_reseller) ~ '(healthy|warming|warmup|warmy)' AND LOWER(p_account_type) = 'google' THEN
    RETURN jsonb_build_object('price', 3.00, 'needs_review', false, 'source', 'Google healthy account');
  END IF;

  -- Unknown: Flag for manual review
  RETURN jsonb_build_object('price', 0, 'needs_review', true, 'source', 'Unknown provider - needs review');
END;
$;

-- Create function to calculate daily sending limit
CREATE OR REPLACE FUNCTION public.calculate_daily_sending_limit(
  p_email_provider TEXT,
  p_reseller TEXT,
  p_domain TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $
DECLARE
  v_limit INTEGER;
  v_needs_review BOOLEAN;
  v_mailbox_count INTEGER;
BEGIN
  -- Mailr: 495 emails/day per domain ÷ mailboxes on domain
  IF LOWER(p_reseller) = 'mailr' THEN
    SELECT mailbox_count INTO v_mailbox_count
    FROM public.domain_mailbox_counts
    WHERE reseller = 'mailr' AND domain = p_domain;

    IF v_mailbox_count IS NOT NULL AND v_mailbox_count > 0 THEN
      v_limit := FLOOR(495.0 / v_mailbox_count);
      RETURN jsonb_build_object('limit', v_limit, 'needs_review', false, 'source', 'Mailr domain-based');
    ELSE
      RETURN jsonb_build_object('limit', 0, 'needs_review', true, 'source', 'Mailr - domain count missing');
    END IF;
  END IF;

  -- ScaledMail: Tiered based on domain size
  IF LOWER(p_reseller) = 'scaledmail' THEN
    SELECT mailbox_count INTO v_mailbox_count
    FROM public.domain_mailbox_counts
    WHERE reseller = 'scaledmail' AND domain = p_domain;

    IF v_mailbox_count >= 49 THEN
      RETURN jsonb_build_object('limit', 5, 'needs_review', false, 'source', 'ScaledMail large domain');
    ELSIF v_mailbox_count >= 25 THEN
      RETURN jsonb_build_object('limit', 8, 'needs_review', false, 'source', 'ScaledMail medium domain');
    ELSIF v_mailbox_count > 0 THEN
      RETURN jsonb_build_object('limit', 5, 'needs_review', false, 'source', 'ScaledMail small domain');
    ELSE
      RETURN jsonb_build_object('limit', 0, 'needs_review', true, 'source', 'ScaledMail - domain count missing');
    END IF;
  END IF;

  -- Google/Gmail: 20 emails/day
  IF LOWER(p_email_provider) IN ('google', 'gmail') THEN
    RETURN jsonb_build_object('limit', 20, 'needs_review', false, 'source', 'Google standard');
  END IF;

  -- Microsoft/Outlook: 20 emails/day
  IF LOWER(p_email_provider) IN ('microsoft', 'outlook') THEN
    RETURN jsonb_build_object('limit', 20, 'needs_review', false, 'source', 'Microsoft standard');
  END IF;

  -- Unknown: Flag for manual review
  RETURN jsonb_build_object('limit', 0, 'needs_review', true, 'source', 'Unknown provider - needs review');
END;
$;
```

#### 2.3 Update poll-sender-emails to Calculate Pricing
**File**: `supabase/functions/poll-sender-emails/index.ts`

Add pricing calculation during upsert:
```typescript
// After extracting provider/reseller/domain (lines 86-88)

// Pre-calculate domain counts for pricing
const domainCounts = new Map<string, number>();
accounts.forEach((acc: any) => {
  const domain = acc.email?.split('@')[1] || '';
  const resellerTag = extractReseller(acc.tags);
  const key = `${resellerTag}:${domain}`;
  domainCounts.set(key, (domainCounts.get(key) || 0) + 1);
});

// Calculate price and sending limit for each account
for (const account of accounts) {
  const domain = account.email?.split('@')[1] || null;
  const provider = extractProvider(account.tags);
  const reseller = extractReseller(account.tags);

  // Calculate price
  const { data: priceData } = await supabase.rpc('calculate_email_account_price', {
    p_reseller: reseller,
    p_email_provider: provider,
    p_domain: domain,
    p_account_type: account.type
  });

  // Calculate daily limit
  const { data: limitData } = await supabase.rpc('calculate_daily_sending_limit', {
    p_email_provider: provider,
    p_reseller: reseller,
    p_domain: domain
  });

  const { error: upsertError } = await supabase
    .from('sender_emails_cache')
    .upsert({
      // ... existing fields ...
      price: priceData?.price || 0,
      price_source: priceData?.source || 'calculated',
      pricing_needs_review: priceData?.needs_review || false,
      daily_limit_calculated: limitData?.limit || 0,
      sending_limit_source: limitData?.source || 'calculated',
      sending_limit_needs_review: limitData?.needs_review || false,
    });
}
```

---

### Phase 3: Update Frontend Field Mappings

**Goal**: Fix dashboard cards to show correct data from new database structure

#### 3.1 Update fieldMappings.ts
```typescript
// Add price and daily limit to field map
export const EMAIL_ACCOUNT_FIELD_MAP = {
  'Email': 'email_address',
  'Status': 'status',
  'Total Sent': 'emails_sent_count',
  'Reply Rate Per Account %': 'reply_rate_percentage', // ✅ Already exists as generated column
  'Price': 'price', // ✅ NEW
  'Daily Limit': 'daily_limit_calculated', // ✅ NEW (use calculated, fallback to bison daily_limit)
  // ... other fields
};

export function transformToEmailAccount(dbRow: any): any {
  return {
    id: dbRow.id,
    fields: {
      'Email': dbRow.email_address,
      'Total Sent': dbRow.emails_sent_count || 0,
      'Reply Rate Per Account %': dbRow.reply_rate_percentage || 0, // Generated column
      'Price': dbRow.price || 0, // NEW
      'Daily Limit': dbRow.daily_limit_calculated || dbRow.daily_limit || 0, // NEW (prefer calculated)
      // ... other fields
    },
  };
}
```

#### 3.2 Update realtimeDataService.ts
Ensure query includes new price fields:
```typescript
const { data: accounts, error } = await supabase
  .from('sender_emails_cache')
  .select('*') // Includes price, reply_rate_percentage, etc.
  .order('last_synced_at', { ascending: false });
```

#### 3.3 Verify Dashboard Card Calculations
**File**: `src/pages/EmailAccountsPage.tsx`

Ensure stat cards calculate correctly:
```typescript
// Total Price calculation (line ~54)
const totalPrice = emailAccounts.reduce((sum, account) => {
  const price = parseFloat(account.fields['Price']) || 0; // Use new Price field
  return sum + price;
}, 0);

// Reply Rate calculation (line ~82-86)
const replyRate = parseFloat(account.fields['Reply Rate Per Account %']) || 0; // Use generated column
```

---

### Phase 4: Data Backfill

**Goal**: Populate domain_mailbox_counts and recalculate all prices

#### 4.1 Create Domain Count Backfill Script
```sql
-- Backfill domain_mailbox_counts from current sender_emails_cache
INSERT INTO public.domain_mailbox_counts (domain, reseller, mailbox_count)
SELECT
  domain,
  reseller,
  COUNT(*) as mailbox_count
FROM public.sender_emails_cache
WHERE domain IS NOT NULL
  AND reseller IN ('scaledmail', 'mailr')
GROUP BY domain, reseller
ON CONFLICT (domain) DO UPDATE SET
  mailbox_count = EXCLUDED.mailbox_count,
  last_updated_at = timezone('utc'::text, now());
```

#### 4.2 Recalculate Prices for All Accounts
```sql
-- Update all accounts with calculated pricing
UPDATE public.sender_emails_cache
SET
  price = (
    SELECT (public.calculate_email_account_price(
      reseller,
      email_provider,
      domain,
      account_type
    )::jsonb)->>'price'
  )::DECIMAL,
  pricing_needs_review = (
    SELECT (public.calculate_email_account_price(
      reseller,
      email_provider,
      domain,
      account_type
    )::jsonb)->>'needs_review'
  )::BOOLEAN,
  daily_limit_calculated = (
    SELECT (public.calculate_daily_sending_limit(
      email_provider,
      reseller,
      domain
    )::jsonb)->>'limit'
  )::INTEGER;
```

---

## 🧪 Testing Plan

### Test 1: Verify All Accounts Are Syncing
```bash
# Check total accounts by instance
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/sender_emails_cache?select=bison_instance&limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Prefer: count=exact" \
  | jq '.'

# Expected:
# - Maverick: ~2,600 accounts
# - Long Run: ~1,400 accounts
# - Total: 4,000+
```

### Test 2: Verify Pricing Is Calculated
```bash
# Check sample prices
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/sender_emails_cache?select=email_address,reseller,price,pricing_needs_review&limit=20" \
  -H "apikey: $SUPABASE_KEY" \
  | jq '.[] | {email: .email_address, reseller, price, needs_review: .pricing_needs_review}'

# Expected:
# - CheapInboxes: $3.00
# - Zapmail: $3.00
# - Mailr: $0.91
# - ScaledMail: varies by domain (check calculation)
```

### Test 3: Verify Dashboard Loads Correctly
1. Open Email Infrastructure Dashboard
2. Check total account count: Should show 4000+
3. Check total price: Should show realistic total (not $0)
4. Check reply rate filter: Should work correctly
5. Check provider breakdown charts: Should show all providers

### Test 4: Verify Real-Time Updates
1. Trigger poll-sender-emails manually
2. Check last_synced_at timestamps
3. Verify dashboard updates without refresh

---

## 📋 Implementation Checklist

### Phase 1: Fix Polling ✅
- [ ] Verify MAVERICK_BISON_API_KEY is set correctly
- [ ] Test poll-sender-emails function manually
- [ ] Check logs for errors with Maverick instance
- [ ] Verify client_registry has correct bison_instance values
- [ ] Confirm pg_cron job is running every 5 minutes

### Phase 2: Add Pricing ✅
- [ ] Add price columns to sender_emails_cache
- [ ] Create domain_mailbox_counts table
- [ ] Create calculate_email_account_price() function
- [ ] Create calculate_daily_sending_limit() function
- [ ] Update poll-sender-emails to call pricing functions
- [ ] Test pricing calculations for each reseller type

### Phase 3: Update Frontend ✅
- [ ] Update fieldMappings.ts with Price and Daily Limit
- [ ] Update transformToEmailAccount() function
- [ ] Verify EmailAccountsPage.tsx uses correct field names
- [ ] Test dashboard stat card calculations
- [ ] Test reply rate filtering

### Phase 4: Data Backfill ✅
- [ ] Backfill domain_mailbox_counts table
- [ ] Recalculate prices for all existing accounts
- [ ] Verify totals match expected values
- [ ] Spot check 20 random accounts for correct pricing

---

## 🎯 Success Criteria

1. ✅ **All 4000+ accounts visible**: Both Maverick and Long Run instances
2. ✅ **Correct pricing displayed**: Based on reseller + provider rules
3. ✅ **Reply rates showing**: Using generated column (already exists)
4. ✅ **Dashboard cards working**: All stat cards show correct aggregated data
5. ✅ **Real-time updates**: Polling every 5 minutes, data stays fresh
6. ✅ **Load time <2 seconds**: Faster than old 30-60s Edge Function

---

## 🚀 Rollback Plan

If issues arise:
1. Set `FEATURE_FLAGS.useRealtimeInfrastructure = false` in dataService.ts
2. Frontend immediately reverts to old Edge Function
3. No data loss (old Edge Function still works)
4. Fix issues in background, re-enable when ready

---

## Timeline Estimate

| Phase | Duration | Risk |
|-------|----------|------|
| 1. Fix Polling | 2 hours | 🟡 Medium |
| 2. Add Pricing | 3 hours | 🟡 Medium |
| 3. Update Frontend | 1 hour | 🟢 Low |
| 4. Data Backfill | 1 hour | 🟢 Low |
| **TOTAL** | **~7 hours** | |

---

## Next Steps

1. **Investigate polling issue** - Why only Long Run accounts are syncing
2. **Add pricing columns** - Extend sender_emails_cache schema
3. **Create pricing functions** - Replicate logic from hybrid-email-accounts-v2
4. **Update frontend** - Fix field mappings and dashboard cards
5. **Test thoroughly** - Verify all 4000+ accounts load with correct data
