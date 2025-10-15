-- =====================================================
-- CONTACT PIPELINE MIGRATIONS - RUN THIS MANUALLY
-- =====================================================
-- These 3 migrations need to be run manually in the Supabase SQL Editor
-- because the exec_sql RPC function is not available.
--
-- Copy and paste this entire file into the Supabase SQL Editor and run it.
-- Dashboard URL: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql
-- =====================================================


-- =====================================================
-- MIGRATION 1: ADD CLEAN CONTACT TARGET
-- =====================================================
-- Add clean_contact_target column to client_registry
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS clean_contact_target INTEGER DEFAULT 0;

COMMENT ON COLUMN public.client_registry.clean_contact_target
IS 'Target for cleaned/verified contacts per month (separate from raw upload target). Represents the goal for contacts that have passed email verification and are ready for campaigns.';

-- Initialize to 0 for all existing clients
UPDATE public.client_registry
SET clean_contact_target = 0
WHERE clean_contact_target IS NULL;

-- Ensure the column is not null
ALTER TABLE public.client_registry
ALTER COLUMN clean_contact_target SET NOT NULL;

-- Add check constraint to ensure reasonable values
ALTER TABLE public.client_registry
ADD CONSTRAINT IF NOT EXISTS check_clean_contact_target_positive
CHECK (clean_contact_target >= 0);

COMMENT ON TABLE public.client_registry IS 'Central registry of all clients with their configuration, targets, and API credentials. Now includes clean_contact_target for verified contact goals.';


-- =====================================================
-- MIGRATION 2: UPDATE PIPELINE SUMMARY VIEW
-- =====================================================
-- Drop existing view
DROP VIEW IF EXISTS public.monthly_contact_pipeline_summary CASCADE;

-- Create updated view with new column structure
CREATE OR REPLACE VIEW public.monthly_contact_pipeline_summary AS
SELECT
  vc.workspace_name,
  vc.month,
  cr.display_name AS client_display_name,
  cr.clean_contact_target,  -- NEW: Renamed from monthly_contact_target
  cr.contact_tier,

  -- Raw uploads (renamed to "total_raw_contacts")
  COUNT(DISTINCT rc.upload_batch_id) AS upload_batch_count,
  COUNT(rc.id) AS total_raw_contacts,  -- RENAMED from raw_contacts_uploaded

  -- Verification stats (simplified - removed breakdown)
  COUNT(vc.id) AS verified_contacts,

  -- Weekly batch tracking
  COUNT(DISTINCT wb.batch_id) AS batches_created,

  -- NEW: Count of batches added to campaign
  COUNT(DISTINCT wb.batch_id) FILTER (
    WHERE wb.bison_upload_status = 'added_to_campaign'
  ) AS added_to_campaign_count,

  -- Gap analysis (NEW: Based on clean_contact_target instead of monthly_contact_target)
  CASE
    WHEN cr.clean_contact_target > 0
    THEN cr.clean_contact_target - COUNT(vc.id)
    ELSE 0
  END AS contacts_gap

FROM public.verified_contacts vc
LEFT JOIN public.raw_contacts rc ON vc.raw_contact_id = rc.id
LEFT JOIN public.weekly_batches wb ON vc.upload_batch_id = wb.batch_id
LEFT JOIN public.client_registry cr ON vc.workspace_name = cr.workspace_name
GROUP BY vc.workspace_name, vc.month, cr.display_name,
         cr.clean_contact_target, cr.contact_tier;

COMMENT ON VIEW public.monthly_contact_pipeline_summary
IS 'Dashboard view showing contact pipeline progress by client/month. Uses clean_contact_target for verified contact goals and tracks campaign additions. Updated 2025-10-14 to simplify columns and focus on key metrics.';


-- =====================================================
-- MIGRATION 3: ENSURE ZIP CLIENTS ARE HOME_INSURANCE
-- =====================================================
-- Update existing clients in client_zipcodes to be home_insurance type
UPDATE public.client_registry cr
SET client_type = 'home_insurance'
WHERE EXISTS (
  SELECT 1 FROM public.client_zipcodes cz
  WHERE cz.workspace_name = cr.workspace_name
)
AND (cr.client_type IS NULL OR cr.client_type != 'home_insurance');

-- Add helpful comment
COMMENT ON COLUMN public.client_registry.client_type
IS 'Client business type: home_insurance (appears in Contact Pipeline + ZIP dashboards), volume (appears in Volume dashboard), or standard. Clients in ZIP dashboard are automatically home_insurance type.';


-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify the migrations were successful:
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'client_registry'
  AND column_name = 'clean_contact_target';

-- Should return 1 row showing the new column

SELECT COUNT(*) as view_exists
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'monthly_contact_pipeline_summary';

-- Should return 1

SELECT
  COUNT(*) as home_insurance_clients
FROM client_registry
WHERE client_type = 'home_insurance';

-- Should show all ZIP dashboard clients
