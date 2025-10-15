-- =====================================================
-- UPDATE CONTACT PIPELINE SUMMARY VIEW
-- =====================================================
-- This migration updates the monthly_contact_pipeline_summary view to:
-- 1. Use clean_contact_target instead of monthly_contact_target
-- 2. Rename raw_contacts_uploaded → total_raw_contacts
-- 3. Remove: deliverable_count, undeliverable_count, risky_count, contacts_uploaded, contacts_pending, hnw_contacts, target_percentage
-- 4. Add: added_to_campaign_count
-- 5. Update Gap calculation to use clean_contact_target
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

  -- REMOVED COLUMNS (no longer in view):
  -- - deliverable_count (detailed verification breakdown not needed)
  -- - undeliverable_count (detailed verification breakdown not needed)
  -- - risky_count (detailed verification breakdown not needed)
  -- - contacts_uploaded (renamed to total_raw_contacts)
  -- - contacts_pending (no longer tracking pending separately)
  -- - hnw_contacts (HNW tracking moved to Kirk Hodgson's workspace)
  -- - target_percentage (removed Progress column from dashboard)

FROM public.verified_contacts vc
LEFT JOIN public.raw_contacts rc ON vc.raw_contact_id = rc.id
LEFT JOIN public.weekly_batches wb ON vc.upload_batch_id = wb.batch_id
LEFT JOIN public.client_registry cr ON vc.workspace_name = cr.workspace_name
GROUP BY vc.workspace_name, vc.month, cr.display_name,
         cr.clean_contact_target, cr.contact_tier;

COMMENT ON VIEW public.monthly_contact_pipeline_summary
IS 'Dashboard view showing contact pipeline progress by client/month. Uses clean_contact_target for verified contact goals and tracks campaign additions. Updated 2025-10-14 to simplify columns and focus on key metrics.';

-- Verify the view was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'monthly_contact_pipeline_summary'
  ) THEN
    RAISE EXCEPTION 'Failed to create monthly_contact_pipeline_summary view';
  END IF;
END $$;
