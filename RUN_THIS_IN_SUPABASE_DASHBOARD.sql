-- =====================================================
-- RUN THIS IN SUPABASE DASHBOARD SQL EDITOR
-- =====================================================
-- This script:
-- 1. Fixes the "Add Client" button by adding write permissions
-- 2. Adds client_type field to distinguish home insurance clients
--
-- Instructions:
-- 1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
-- 2. Copy/paste this entire script
-- 3. Click "Run" button
-- =====================================================

-- PART 1: Allow authenticated users to insert new ZIP assignments
CREATE POLICY IF NOT EXISTS "Authenticated users can insert client_zipcodes"
ON public.client_zipcodes
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update existing ZIP assignments
CREATE POLICY IF NOT EXISTS "Authenticated users can update client_zipcodes"
ON public.client_zipcodes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete ZIP assignments (for cleanup/reassignment)
CREATE POLICY IF NOT EXISTS "Authenticated users can delete client_zipcodes"
ON public.client_zipcodes
FOR DELETE
TO authenticated
USING (true);

-- PART 2: Add client_type field
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
UPDATE public.client_registry
SET client_type = 'home_insurance'
WHERE workspace_name IN (
  SELECT DISTINCT workspace_name
  FROM public.client_zipcodes
  WHERE workspace_name IS NOT NULL
);

-- Verify everything worked
SELECT
  'Policies Created' as check_type,
  COUNT(*) as count
FROM pg_policies
WHERE tablename = 'client_zipcodes'
UNION ALL
SELECT
  'Home Insurance Clients' as check_type,
  COUNT(*) as count
FROM public.client_registry
WHERE client_type = 'home_insurance'
UNION ALL
SELECT
  'Other Clients' as check_type,
  COUNT(*) as count
FROM public.client_registry
WHERE client_type = 'other';
