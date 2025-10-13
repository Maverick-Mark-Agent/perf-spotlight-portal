-- =====================================================
-- FIX: Add INSERT/UPDATE permissions for client_zipcodes
-- =====================================================
-- This migration fixes the "Add Agency" button on ZIP Dashboard
-- by allowing authenticated users to insert and update ZIP assignments.
--
-- Issue: Previously only SELECT was allowed for authenticated users,
-- causing all INSERT operations (assigning ZIPs to agencies) to fail silently.
-- =====================================================

-- Allow authenticated users to insert new ZIP assignments
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

-- Add comment for documentation
COMMENT ON POLICY "Authenticated users can insert client_zipcodes" ON public.client_zipcodes
IS 'Allows ZIP Dashboard to assign ZIPs to agencies and create new agency entries';

COMMENT ON POLICY "Authenticated users can update client_zipcodes" ON public.client_zipcodes
IS 'Allows ZIP Dashboard to reassign ZIPs between agencies and update agency colors';

COMMENT ON POLICY "Authenticated users can delete client_zipcodes" ON public.client_zipcodes
IS 'Allows ZIP Dashboard to remove ZIP assignments or cleanup placeholder entries';
