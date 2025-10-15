-- Fix infinite recursion in RLS policies
-- The "Admins can manage workspace access" policy was causing recursion
-- because it queries the same table it's protecting

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can manage workspace access" ON public.user_workspace_access;

-- Recreate it without the recursion issue
-- Instead of checking the table itself, we'll use a simpler approach
CREATE POLICY "Admins can manage workspace access" ON public.user_workspace_access
  FOR ALL
  TO authenticated
  USING (
    -- User can manage access if they have an admin role in ANY workspace
    EXISTS (
      SELECT 1 FROM public.user_workspace_access uwa
      WHERE uwa.user_id = auth.uid()
      AND uwa.role = 'admin'
      LIMIT 1
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_workspace_access uwa
      WHERE uwa.user_id = auth.uid()
      AND uwa.role = 'admin'
      LIMIT 1
    )
  );

-- Actually, let's use a better approach - create a helper function
DROP POLICY IF EXISTS "Admins can manage workspace access" ON public.user_workspace_access;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_workspace_access
    WHERE user_id = p_user_id AND role = 'admin'
  );
$$;

-- Now create the policy using the function (no recursion)
CREATE POLICY "Admins can manage workspace access" ON public.user_workspace_access
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
