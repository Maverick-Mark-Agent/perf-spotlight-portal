-- =====================================================
-- FIX RLS POLICIES TO ALLOW ADMINS FULL ACCESS
-- =====================================================
-- Updates client_leads RLS policies so admin users can access
-- ALL workspaces, not just their assigned ones
-- =====================================================

-- Drop existing authenticated user policies
DROP POLICY IF EXISTS "Users can view leads from their workspaces" ON public.client_leads;
DROP POLICY IF EXISTS "Users can update leads in their workspaces" ON public.client_leads;

-- Create new SELECT policy that gives admins full access
CREATE POLICY "Users can view leads from their workspaces or all if admin" ON public.client_leads
  FOR SELECT
  TO authenticated
  USING (
    -- User is admin: can see ALL leads
    EXISTS (
      SELECT 1
      FROM public.user_workspace_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    -- User is not admin: can only see leads from their assigned workspaces
    workspace_name IN (
      SELECT workspace_name
      FROM public.user_workspace_access
      WHERE user_id = auth.uid()
    )
  );

-- Create new UPDATE policy that gives admins full access
CREATE POLICY "Users can update leads in their workspaces or all if admin" ON public.client_leads
  FOR UPDATE
  TO authenticated
  USING (
    -- User is admin: can update ALL leads
    EXISTS (
      SELECT 1
      FROM public.user_workspace_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    -- User is not admin: can only update leads from their assigned workspaces
    workspace_name IN (
      SELECT workspace_name
      FROM public.user_workspace_access
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same check for WITH CHECK
    EXISTS (
      SELECT 1
      FROM public.user_workspace_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    workspace_name IN (
      SELECT workspace_name
      FROM public.user_workspace_access
      WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON POLICY "Users can view leads from their workspaces or all if admin" ON public.client_leads IS
  'Admin users can view ALL leads. Client users can only view leads from their assigned workspaces.';

COMMENT ON POLICY "Users can update leads in their workspaces or all if admin" ON public.client_leads IS
  'Admin users can update ALL leads. Client users can only update leads from their assigned workspaces.';
