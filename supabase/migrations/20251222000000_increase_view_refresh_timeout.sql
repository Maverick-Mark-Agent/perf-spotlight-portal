-- Migration: Increase View Refresh Timeout to 60 seconds
-- Purpose: Fix view refresh timing out with 11,000+ email accounts
-- Issue: email_accounts_view not syncing with email_accounts_raw due to 30s timeout
-- Date: 2025-12-22

-- Update email_accounts_view refresh function with increased timeout
CREATE OR REPLACE FUNCTION public.refresh_email_accounts_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Increased from 30s to 60s to handle 11,000+ accounts
  SET LOCAL statement_timeout = '60s';

  -- Refresh the materialized view concurrently
  -- CONCURRENTLY allows reads while refreshing but requires unique index
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.email_accounts_view;

  RAISE NOTICE 'Successfully refreshed email_accounts_view';
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to refresh email_accounts_view: %', SQLERRM;
    -- Re-raise to propagate error to caller
    RAISE;
END;
$$;

-- Update home_insurance_view refresh function with increased timeout
CREATE OR REPLACE FUNCTION public.refresh_home_insurance_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Increased from 30s to 60s
  SET LOCAL statement_timeout = '60s';

  -- Refresh the home insurance materialized view concurrently
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.email_accounts_home_insurance_view;

  RAISE NOTICE 'Successfully refreshed email_accounts_home_insurance_view';
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to refresh email_accounts_home_insurance_view: %', SQLERRM;
    -- Re-raise to propagate error to caller
    RAISE;
END;
$$;

-- Update comments
COMMENT ON FUNCTION public.refresh_email_accounts_view IS
'Refreshes the email_accounts_view materialized view with a 60-second statement timeout (increased from 30s to handle 11k+ accounts). Called after each poll-sender-emails sync to ensure frontend sees fresh data.';

COMMENT ON FUNCTION public.refresh_home_insurance_view IS
'Refreshes the email_accounts_home_insurance_view materialized view with a 60-second statement timeout.';

-- Verify the functions were updated
DO $$
BEGIN
  RAISE NOTICE '✅ View refresh functions updated with 60-second statement timeout';
  RAISE NOTICE 'Functions updated:';
  RAISE NOTICE '  - public.refresh_email_accounts_view()';
  RAISE NOTICE '  - public.refresh_home_insurance_view()';
END $$;
