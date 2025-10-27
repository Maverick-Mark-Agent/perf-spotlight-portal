-- ============================================================================
-- QUICK FIX: Add volume_per_account to fix 0% utilization issue
-- ============================================================================
-- Run this SQL in Supabase SQL Editor to fix Client Sending Capacity Analysis
-- ============================================================================

-- Step 1: Add column to email_accounts_raw
ALTER TABLE public.email_accounts_raw
ADD COLUMN IF NOT EXISTS volume_per_account INTEGER DEFAULT NULL;

-- Step 2: Set values for existing accounts (use daily_limit as baseline)
UPDATE public.email_accounts_raw
SET volume_per_account = GREATEST(daily_limit, 15)
WHERE volume_per_account IS NULL;

-- Step 3: Make it NOT NULL
ALTER TABLE public.email_accounts_raw
ALTER COLUMN volume_per_account SET NOT NULL;

ALTER TABLE public.email_accounts_raw
ALTER COLUMN volume_per_account SET DEFAULT 15;

-- Step 4: Recreate materialized view with the new column
DROP MATERIALIZED VIEW IF EXISTS public.email_accounts_view CASCADE;

CREATE MATERIALIZED VIEW public.email_accounts_view AS
SELECT
  id, bison_account_id, email_address, workspace_name, workspace_id,
  bison_instance, status, account_type, emails_sent_count, total_replied_count,
  unique_replied_count, bounced_count, unsubscribed_count, interested_leads_count,
  total_opened_count, unique_opened_count, total_leads_contacted_count,
  daily_limit, warmup_enabled, reply_rate_percentage, email_provider,
  reseller, domain, price, price_source, pricing_needs_review,
  volume_per_account,
  notes, created_at, updated_at, last_synced_at
FROM public.email_accounts_raw
WHERE deleted_at IS NULL
ORDER BY workspace_name, email_address;

-- Step 5: Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_view_id ON public.email_accounts_view(id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_workspace ON public.email_accounts_view(workspace_name);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_email ON public.email_accounts_view(email_address);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_status ON public.email_accounts_view(status);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_instance ON public.email_accounts_view(bison_instance);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_synced ON public.email_accounts_view(last_synced_at DESC);

-- Step 6: Grant permissions
GRANT SELECT ON public.email_accounts_view TO anon;
GRANT SELECT ON public.email_accounts_view TO authenticated;
GRANT ALL ON public.email_accounts_view TO service_role;

-- Step 7: Verify success
SELECT
  'Migration complete!' as status,
  COUNT(*) as total_active_accounts,
  SUM(volume_per_account) as total_volume_capacity,
  SUM(daily_limit) as total_daily_limit,
  ROUND(AVG(volume_per_account), 2) as avg_volume_per_account
FROM public.email_accounts_view;
