-- =====================================================
-- ALLOW ADMINS TO ACCESS ALL CLIENT PORTALS
-- =====================================================
-- Updates get_user_workspaces function to return ALL workspaces
-- for users with admin role, not just their assigned workspaces
-- =====================================================

DROP FUNCTION IF EXISTS public.get_user_workspaces(uuid);

CREATE OR REPLACE FUNCTION public.get_user_workspaces(p_user_id UUID)
RETURNS TABLE (
  workspace_id INTEGER,
  workspace_name TEXT,
  role TEXT,
  leads_count BIGINT,
  won_leads_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_is_admin BOOLEAN;
BEGIN
  -- Check if user has admin role
  SELECT EXISTS (
    SELECT 1
    FROM public.user_workspace_access
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO user_is_admin;

  IF user_is_admin THEN
    -- Admin users: Return ALL workspaces from client_registry
    RETURN QUERY
    SELECT
      cr.workspace_id,
      cr.workspace_name,
      'admin'::TEXT as role,
      COUNT(DISTINCT cl.id) AS leads_count,
      COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won') AS won_leads_count
    FROM public.client_registry cr
    LEFT JOIN public.client_leads cl ON cl.workspace_name = cr.workspace_name
    GROUP BY cr.workspace_id, cr.workspace_name
    ORDER BY cr.workspace_name;
  ELSE
    -- Regular users: Return only their assigned workspaces
    RETURN QUERY
    SELECT
      cr.workspace_id,
      uwa.workspace_name,
      uwa.role,
      COUNT(DISTINCT cl.id) AS leads_count,
      COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won') AS won_leads_count
    FROM public.user_workspace_access uwa
    LEFT JOIN public.client_registry cr ON cr.workspace_name = uwa.workspace_name
    LEFT JOIN public.client_leads cl ON cl.workspace_name = uwa.workspace_name
    WHERE uwa.user_id = p_user_id
    GROUP BY cr.workspace_id, uwa.workspace_name, uwa.role
    ORDER BY uwa.workspace_name;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_workspaces TO authenticated;

-- Update comment
COMMENT ON FUNCTION public.get_user_workspaces IS 'Get workspaces accessible by a user. Admins see ALL workspaces, clients see only assigned workspaces.';
