-- =====================================================
-- HOTFIX: role column ambiguity in get_workspace_lead_counts
-- =====================================================
-- The previous migration 20260420120000 introduced a function with
-- an OUT parameter named `role` that shadowed column references in
-- the admin-check subquery, so non-admin callers got:
--   ERROR: column reference "role" is ambiguous
-- The frontend swallowed this as "no workspaces," hiding the portal
-- from every client user (admins with NULL user_id were unaffected).
--
-- Fix: alias the table and fully qualify column references inside
-- the admin-check subquery.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_workspace_lead_counts(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  workspace_id     INTEGER,
  workspace_name   TEXT,
  role             TEXT,
  leads_count      BIGINT,
  won_leads_count  BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_workspace_access uwa
      WHERE uwa.user_id = p_user_id AND uwa.role = 'admin'
    ) INTO v_is_admin;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT cr.workspace_id,
           cr.workspace_name,
           COALESCE(uwa.role, 'admin') AS role
    FROM public.client_registry cr
    LEFT JOIN public.user_workspace_access uwa
      ON LOWER(TRIM(uwa.workspace_name)) = LOWER(TRIM(cr.workspace_name))
     AND uwa.user_id = p_user_id
    WHERE p_user_id IS NULL
       OR v_is_admin
       OR uwa.user_id = p_user_id
  ),
  counts AS (
    SELECT LOWER(TRIM(cl.workspace_name)) AS key,
           COUNT(*) FILTER (
             WHERE cl.interested = true
               AND cl.deleted_at IS NULL
           ) AS leads_count,
           COUNT(*) FILTER (
             WHERE cl.interested = true
               AND cl.deleted_at IS NULL
               AND cl.pipeline_stage = 'won'
           ) AS won_leads_count
    FROM public.client_leads cl
    GROUP BY LOWER(TRIM(cl.workspace_name))
  )
  SELECT v.workspace_id,
         v.workspace_name,
         v.role,
         COALESCE(c.leads_count, 0)::BIGINT,
         COALESCE(c.won_leads_count, 0)::BIGINT
  FROM visible v
  LEFT JOIN counts c ON c.key = LOWER(TRIM(v.workspace_name))
  ORDER BY v.workspace_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_lead_counts(UUID) TO authenticated;
