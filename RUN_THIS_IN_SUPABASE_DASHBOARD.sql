-- =====================================================
-- RUN THIS IN SUPABASE DASHBOARD SQL EDITOR
-- =====================================================
-- This fixes the "Add Agency" button by adding write permissions
-- to the client_zipcodes table.
--
-- Instructions:
-- 1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
-- 2. Copy/paste this entire script
-- 3. Click "Run" button
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

-- Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'client_zipcodes'
ORDER BY policyname;
