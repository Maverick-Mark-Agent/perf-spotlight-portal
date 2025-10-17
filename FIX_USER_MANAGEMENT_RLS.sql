-- =====================================================
-- FIX USER MANAGEMENT DASHBOARD
-- =====================================================
-- Issue: User Management can't query all users because RLS policy
-- only allows authenticated users to see their own records.
--
-- Solution: Add anon read policy to allow admin dashboard
-- to query all user workspace access (matches pattern used
-- for other admin tables like client_leads, client_registry)
-- =====================================================

-- Add anon read policy to user_workspace_access table
-- This allows the admin dashboard to query all users using the anon key
CREATE POLICY IF NOT EXISTS "Anon read access for admin dashboard"
ON public.user_workspace_access
  FOR SELECT
  TO anon
  USING (true);

-- Verify the policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_workspace_access'
ORDER BY policyname;

-- Test query (should return all records)
SELECT
  user_id,
  workspace_name,
  role,
  created_at
FROM public.user_workspace_access
ORDER BY created_at DESC;
