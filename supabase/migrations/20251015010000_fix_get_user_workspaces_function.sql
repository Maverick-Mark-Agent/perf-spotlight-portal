-- =====================================================
-- FIX get_user_workspaces FUNCTION TO INCLUDE WORKSPACE_ID
-- =====================================================
-- The function needs to return workspace_id from client_registry
-- so the frontend can properly display workspaces
-- =====================================================

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
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS workspace_id,
    uwa.workspace_name,
    uwa.role,
    COUNT(DISTINCT cl.id) AS leads_count,
    COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won') AS won_leads_count
  FROM public.user_workspace_access uwa
  LEFT JOIN public.client_registry cr ON cr.workspace_name = uwa.workspace_name
  LEFT JOIN public.client_leads cl ON cl.workspace_name = uwa.workspace_name
  WHERE uwa.user_id = p_user_id
  GROUP BY cr.id, uwa.workspace_name, uwa.role
  ORDER BY uwa.workspace_name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_workspaces TO authenticated;

-- Update comment
COMMENT ON FUNCTION public.get_user_workspaces IS 'Get all workspaces accessible by a user with workspace_id and lead counts';
