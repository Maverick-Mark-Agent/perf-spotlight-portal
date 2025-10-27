-- ============================================================================
-- ADD volume_per_account COLUMN TO email_accounts_raw
-- ============================================================================
-- Purpose: Fix Client Sending Capacity Analysis showing 0% utilization
-- Issue: volume_per_account column was defined in sender_emails_cache but
--        never added to email_accounts_raw table
-- Date: 2025-10-26
-- ============================================================================

-- Add volume_per_account column to email_accounts_raw
ALTER TABLE public.email_accounts_raw
ADD COLUMN IF NOT EXISTS volume_per_account INTEGER DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.email_accounts_raw.volume_per_account IS
'Maximum theoretical sending volume per account. For capacity planning and utilization calculations. Typically 15 emails/day for new accounts, can scale to 50+ for aged accounts.';

-- Set default value based on daily_limit for existing accounts
-- Most accounts have volume_per_account = daily_limit + buffer (typically 1.2-1.5x)
-- For simplicity, we'll set it equal to daily_limit initially
UPDATE public.email_accounts_raw
SET volume_per_account = GREATEST(daily_limit, 15)  -- Minimum 15, or use daily_limit if higher
WHERE volume_per_account IS NULL;

-- Make it NOT NULL after setting defaults
ALTER TABLE public.email_accounts_raw
ALTER COLUMN volume_per_account SET NOT NULL;

ALTER TABLE public.email_accounts_raw
ALTER COLUMN volume_per_account SET DEFAULT 15;

-- ============================================================================
-- RECREATE MATERIALIZED VIEW WITH volume_per_account
-- ============================================================================

-- Drop existing view
DROP MATERIALIZED VIEW IF EXISTS public.email_accounts_view CASCADE;

-- Recreate view with ALL columns including volume_per_account
CREATE MATERIALIZED VIEW public.email_accounts_view AS
SELECT
  id,
  bison_account_id,
  email_address,
  workspace_name,
  workspace_id,
  bison_instance,
  status,
  account_type,
  emails_sent_count,
  total_replied_count,
  unique_replied_count,
  bounced_count,
  unsubscribed_count,
  interested_leads_count,
  total_opened_count,
  unique_opened_count,
  total_leads_contacted_count,
  daily_limit,
  warmup_enabled,
  reply_rate_percentage,
  email_provider,
  reseller,
  domain,
  price,
  price_source,
  pricing_needs_review,
  volume_per_account,  -- ✅ NOW INCLUDED
  notes,
  created_at,
  updated_at,
  last_synced_at
FROM public.email_accounts_raw
WHERE deleted_at IS NULL  -- ✅ Only show active accounts
ORDER BY workspace_name, email_address;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_view_id
ON public.email_accounts_view(id);

CREATE INDEX IF NOT EXISTS idx_email_accounts_view_workspace
ON public.email_accounts_view(workspace_name);

CREATE INDEX IF NOT EXISTS idx_email_accounts_view_email
ON public.email_accounts_view(email_address);

CREATE INDEX IF NOT EXISTS idx_email_accounts_view_status
ON public.email_accounts_view(status);

CREATE INDEX IF NOT EXISTS idx_email_accounts_view_instance
ON public.email_accounts_view(bison_instance);

CREATE INDEX IF NOT EXISTS idx_email_accounts_view_synced
ON public.email_accounts_view(last_synced_at DESC);

-- Grant permissions
GRANT SELECT ON public.email_accounts_view TO anon;
GRANT SELECT ON public.email_accounts_view TO authenticated;
GRANT ALL ON public.email_accounts_view TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
  'Migration complete!' as status,
  COUNT(*) as total_active_accounts,
  COUNT(*) FILTER (WHERE volume_per_account IS NOT NULL) as accounts_with_volume,
  COUNT(*) FILTER (WHERE volume_per_account IS NULL) as accounts_missing_volume,
  SUM(volume_per_account) as total_volume_capacity,
  SUM(daily_limit) as total_daily_limit,
  ROUND(AVG(volume_per_account), 2) as avg_volume_per_account
FROM public.email_accounts_view;
