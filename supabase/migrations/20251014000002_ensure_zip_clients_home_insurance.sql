-- =====================================================
-- ENSURE ZIP DASHBOARD CLIENTS ARE HOME_INSURANCE TYPE
-- =====================================================
-- This migration ensures that any client appearing in the ZIP dashboard
-- (client_zipcodes table) is automatically marked as client_type = 'home_insurance'
-- in the client_registry.
--
-- This enables automatic appearance in the Contact Pipeline Dashboard,
-- which shows all home_insurance clients.
-- =====================================================

-- Update existing clients in client_zipcodes to be home_insurance type
UPDATE public.client_registry cr
SET client_type = 'home_insurance'
WHERE EXISTS (
  SELECT 1 FROM public.client_zipcodes cz
  WHERE cz.workspace_name = cr.workspace_name
)
AND (cr.client_type IS NULL OR cr.client_type != 'home_insurance');

-- Log how many clients were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.client_registry cr
  WHERE EXISTS (
    SELECT 1 FROM public.client_zipcodes cz
    WHERE cz.workspace_name = cr.workspace_name
  )
  AND cr.client_type = 'home_insurance';

  RAISE NOTICE 'Ensured % clients from ZIP dashboard are marked as home_insurance', updated_count;
END $$;

-- Add helpful comment
COMMENT ON COLUMN public.client_registry.client_type
IS 'Client business type: home_insurance (appears in Contact Pipeline + ZIP dashboards), volume (appears in Volume dashboard), or standard. Clients in ZIP dashboard are automatically home_insurance type.';
