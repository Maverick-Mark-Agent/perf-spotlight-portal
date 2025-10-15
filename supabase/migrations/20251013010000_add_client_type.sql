-- =====================================================
-- ADD CLIENT TYPE TO CLIENT REGISTRY
-- =====================================================
-- This migration adds a client_type field to distinguish between:
-- - home_insurance: Uses ZIP Dashboard and Contact Pipeline
-- - other: Standard clients without ZIP/Contact features
-- =====================================================

-- Add client_type column
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'other' CHECK (client_type IN ('home_insurance', 'other'));

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_client_registry_client_type
ON public.client_registry(client_type)
WHERE client_type = 'home_insurance';

-- Add comment
COMMENT ON COLUMN public.client_registry.client_type IS
'Client type: home_insurance = uses ZIP Dashboard & Contact Pipeline, other = standard client without these features';

-- Update existing clients that are clearly home insurance based on their ZIP assignments
-- (Clients with ZIP codes are home insurance clients)
UPDATE public.client_registry
SET client_type = 'home_insurance'
WHERE workspace_name IN (
  SELECT DISTINCT workspace_name
  FROM public.client_zipcodes
  WHERE workspace_name IS NOT NULL
);

-- Verify the update
SELECT
  client_type,
  COUNT(*) as client_count,
  STRING_AGG(display_name, ', ' ORDER BY display_name) as clients
FROM public.client_registry
GROUP BY client_type
ORDER BY client_type;
