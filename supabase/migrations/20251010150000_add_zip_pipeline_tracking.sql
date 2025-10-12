-- =====================================================
-- ZIP CODE CONTACT PIPELINE: Agency & Month Tracking
-- =====================================================
-- This migration adds:
-- 1. View to track ZIP-based contact pipeline progress
-- 2. Kirk Hodgson as HNW receiver for Texas agencies
-- 3. Auto-sync between ZIP Dashboard and Contact Management
-- =====================================================

-- =====================================================
-- 1. CREATE VIEW: ZIP Pipeline Summary
-- =====================================================
-- Aggregates zip_batch_pulls data to show:
-- - Total ZIPs assigned per agency/month
-- - ZIPs pulled (with uploaded contacts)
-- - Raw contacts uploaded
-- - Qualified contacts (HOH filtered)
-- - HNW contacts routed to Kirk Hodgson (for Texas agencies)

CREATE OR REPLACE VIEW public.zip_pipeline_summary AS
SELECT
  zbp.workspace_name,
  zbp.month,

  -- ZIP Code Progress
  COUNT(DISTINCT zbp.zip) AS total_zips,
  COUNT(DISTINCT zbp.zip) FILTER (WHERE zbp.raw_contacts_uploaded > 0) AS zips_pulled,
  COUNT(DISTINCT zbp.zip) FILTER (WHERE zbp.raw_contacts_uploaded = 0) AS zips_remaining,

  -- Contact Counts
  COALESCE(SUM(zbp.raw_contacts_uploaded), 0) AS total_raw_contacts,
  COALESCE(SUM(zbp.qualified_contacts), 0) AS total_qualified_contacts,
  COALESCE(SUM(zbp.deliverable_contacts), 0) AS total_deliverable_contacts,

  -- Batch Progress
  COUNT(DISTINCT zbp.batch_number) AS total_batches,
  COUNT(DISTINCT zbp.batch_number) FILTER (WHERE zbp.raw_contacts_uploaded > 0) AS batches_uploaded,
  COUNT(DISTINCT zbp.batch_number) FILTER (WHERE zbp.uploaded_to_bison = true) AS batches_sent_to_bison,

  -- Progress Percentage
  CASE
    WHEN COUNT(DISTINCT zbp.zip) > 0
    THEN ROUND((COUNT(DISTINCT zbp.zip) FILTER (WHERE zbp.raw_contacts_uploaded > 0)::DECIMAL / COUNT(DISTINCT zbp.zip)) * 100, 1)
    ELSE 0
  END AS zip_completion_percentage,

  -- Timestamps
  MIN(zbp.created_at) AS first_batch_created,
  MAX(zbp.pulled_at) AS last_pull_date

FROM public.zip_batch_pulls zbp
GROUP BY zbp.workspace_name, zbp.month;

COMMENT ON VIEW public.zip_pipeline_summary IS 'Dashboard view showing ZIP-based contact pipeline progress by agency/month';


-- =====================================================
-- 2. CREATE VIEW: HNW Routing Summary (Kirk Hodgson Tracker)
-- =====================================================
-- Tracks HNW contacts routed from Texas agencies to Kirk Hodgson

CREATE OR REPLACE VIEW public.hnw_routing_summary AS
WITH texas_agencies AS (
  SELECT unnest(ARRAY['Kim Wallace', 'David Amiri', 'John Roberts', 'Jason Binyon']) AS workspace_name
),
kirk_hodgson_contacts AS (
  SELECT
    'Kirk Hodgson' AS receiver_name,
    month,
    COUNT(*) AS total_hnw_contacts,
    STRING_AGG(DISTINCT source_agency, ', ' ORDER BY source_agency) AS source_agencies
  FROM (
    -- This will be populated when we store HNW routing data
    -- For now, we'll pull from storage CSV files via Edge Function
    SELECT
      month,
      'Kirk Hodgson' AS receiver,
      workspace_name AS source_agency
    FROM public.zip_batch_pulls zbp
    INNER JOIN texas_agencies ta ON zbp.workspace_name = ta.workspace_name
    WHERE zbp.qualified_contacts > 0
  ) sub
  GROUP BY month
)
SELECT * FROM kirk_hodgson_contacts;

COMMENT ON VIEW public.hnw_routing_summary IS 'Tracks HNW contacts (>$900k) routed from Texas agencies to Kirk Hodgson';


-- =====================================================
-- 3. ADD KIRK HODGSON TO CLIENT_ZIPCODES
-- =====================================================
-- Add Kirk Hodgson as a special "HNW Receiver" agency
-- He won't have ZIP assignments, but will show up in dashboards

-- First, check if Kirk Hodgson exists in client_registry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.client_registry WHERE workspace_name = 'Kirk Hodgson'
  ) THEN
    INSERT INTO public.client_registry (
      workspace_name,
      display_name,
      is_active,
      contact_tier,
      monthly_contact_target,
      price_per_lead
    ) VALUES (
      'Kirk Hodgson',
      'Kirk Hodgson (HNW Receiver)',
      true,
      'premium',
      0, -- No monthly target, receives HNW from others
      0  -- No pricing, this is routing only
    );
  END IF;
END $$;

-- Add a placeholder entry for Kirk Hodgson in client_zipcodes for November 2025
-- This makes him show up in ZIP Dashboard with 0 ZIPs assigned
INSERT INTO public.client_zipcodes (
  zip,
  month,
  client_name,
  workspace_name,
  agency_color,
  state,
  source
) VALUES (
  '00000-HNW', -- Special placeholder ZIP for HNW receiver
  '2025-11',
  'Kirk Hodgson (HNW Receiver)',
  'Kirk Hodgson',
  '#10B981', -- Green color for HNW
  NULL,
  'hnw_receiver'
) ON CONFLICT (zip, month) DO NOTHING;


-- =====================================================
-- 4. CREATE FUNCTION: Auto-Sync ZIP Dashboard Agencies
-- =====================================================
-- When an agency is added to client_zipcodes, automatically:
-- 1. Add to client_registry if not exists
-- 2. Create placeholder entry in zip_batch_pulls for the month

CREATE OR REPLACE FUNCTION public.sync_zip_agency_to_contact_pipeline()
RETURNS TRIGGER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if workspace_name exists in client_registry
  SELECT EXISTS(
    SELECT 1 FROM public.client_registry
    WHERE workspace_name = NEW.workspace_name
  ) INTO v_exists;

  -- If not exists, create it
  IF NOT v_exists THEN
    INSERT INTO public.client_registry (
      workspace_name,
      display_name,
      is_active,
      contact_tier,
      monthly_contact_target
    ) VALUES (
      NEW.workspace_name,
      NEW.client_name,
      true,
      'standard', -- Default tier
      1000 -- Default target, can be updated later
    ) ON CONFLICT (workspace_name) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on client_zipcodes INSERT
DROP TRIGGER IF EXISTS trg_sync_zip_agency ON public.client_zipcodes;
CREATE TRIGGER trg_sync_zip_agency
  AFTER INSERT ON public.client_zipcodes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_zip_agency_to_contact_pipeline();

COMMENT ON FUNCTION public.sync_zip_agency_to_contact_pipeline IS 'Auto-syncs agencies from ZIP Dashboard to Contact Management Portal';


-- =====================================================
-- 5. ADD RLS POLICIES FOR NEW VIEWS
-- =====================================================

-- Public read access to zip_pipeline_summary
DROP POLICY IF EXISTS "Public read zip_pipeline_summary" ON public.zip_pipeline_summary;
-- Views don't support RLS directly, policies handled by underlying tables

-- Public read access to hnw_routing_summary
DROP POLICY IF EXISTS "Public read hnw_routing_summary" ON public.hnw_routing_summary;
-- Views don't support RLS directly, policies handled by underlying tables


-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON public.zip_pipeline_summary TO anon, authenticated;
GRANT SELECT ON public.hnw_routing_summary TO anon, authenticated;
