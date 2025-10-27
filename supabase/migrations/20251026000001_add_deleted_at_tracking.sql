-- ============================================================================
-- ADD SOFT-DELETE TRACKING TO EMAIL ACCOUNTS
-- ============================================================================
-- Purpose: Track deleted accounts without losing historical data
-- Date: 2025-10-26
-- ============================================================================

-- Add deleted_at column to track soft deletes
ALTER TABLE public.email_accounts_raw
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for fast filtering of active accounts
CREATE INDEX IF NOT EXISTS idx_email_accounts_raw_deleted
ON public.email_accounts_raw(deleted_at)
WHERE deleted_at IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.email_accounts_raw.deleted_at IS
'Timestamp when account was detected as deleted from Bison. NULL = active account, non-NULL = deleted/archived account';

-- ============================================================================
-- UPDATE MATERIALIZED VIEW TO FILTER DELETED ACCOUNTS
-- ============================================================================

-- Drop existing view
DROP MATERIALIZED VIEW IF EXISTS public.email_accounts_view CASCADE;

-- Recreate view with deleted_at filter
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
  notes,
  created_at,
  updated_at,
  last_synced_at
FROM public.email_accounts_raw
WHERE deleted_at IS NULL  -- ✅ CRITICAL: Only show active accounts
ORDER BY workspace_name, email_address;

-- Create indexes on materialized view for fast queries
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
-- HELPER FUNCTION: Get Account Deletion Statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_deletion_stats()
RETURNS TABLE (
  workspace_name TEXT,
  total_accounts BIGINT,
  active_accounts BIGINT,
  deleted_accounts BIGINT,
  deletion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ear.workspace_name,
    COUNT(*) as total_accounts,
    COUNT(*) FILTER (WHERE ear.deleted_at IS NULL) as active_accounts,
    COUNT(*) FILTER (WHERE ear.deleted_at IS NOT NULL) as deleted_accounts,
    ROUND(
      (COUNT(*) FILTER (WHERE ear.deleted_at IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0) * 100),
      2
    ) as deletion_rate
  FROM public.email_accounts_raw ear
  GROUP BY ear.workspace_name
  ORDER BY deleted_accounts DESC;
END;
$$ LANGUAGE plpgsql;

-- Verify migration
SELECT
  'Migration complete!' as status,
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_accounts,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_accounts
FROM public.email_accounts_raw;
