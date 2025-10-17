-- =====================================================
-- FIX USER MANAGEMENT DASHBOARD RLS
-- =====================================================
-- Issue: User Management dashboard couldn't query all users
-- because RLS policy only allowed authenticated users to
-- see their own records.
--
-- Solution: Add anon read policy to allow admin dashboard
-- to query all user workspace access records using anon key
-- (matches pattern used for other admin tables)
-- =====================================================

-- Drop existing anon policy if it exists
DROP POLICY IF EXISTS "Anon read access for admin dashboard" ON public.user_workspace_access;

-- Add anon read policy to user_workspace_access table
-- This allows the admin dashboard to query all users using the anon key
CREATE POLICY "Anon read access for admin dashboard"
ON public.user_workspace_access
  FOR SELECT
  TO anon
  USING (true);

-- Add comment
COMMENT ON POLICY "Anon read access for admin dashboard" ON public.user_workspace_access IS
  'Allows admin dashboard to query all user workspace access using anon key. Required for User Management page.';
