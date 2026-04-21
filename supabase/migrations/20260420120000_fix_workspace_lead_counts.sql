-- =====================================================
-- FIX HUB LEAD COUNTS — server-side aggregation RPC
-- =====================================================
-- The admin Client Portal Hub previously fetched raw client_leads
-- rows and aggregated counts client-side. That query is subject to
-- PostgREST's row-limit truncation (confirmed undercount: 11,738
-- interested rows in DB, hub returning far fewer). Moving the
-- aggregation into Postgres removes the row-limit dependency
-- entirely.
--
-- Joins on LOWER(TRIM(workspace_name)) to rescue rows with casing
-- or trailing-whitespace drift (e.g. "Heidi Rowan Agency " with a
-- trailing space, "Tactical HR" vs registry's "Tactical Hr").
--
-- Filters match the portal kanban's default view:
--   interested = true AND deleted_at IS NULL
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
      SELECT 1 FROM public.user_workspace_access
      WHERE user_id = p_user_id AND role = 'admin'
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

COMMENT ON FUNCTION public.get_workspace_lead_counts IS
  'Hub lead counts. interested=true, deleted_at IS NULL. NULL user_id or admin role returns all registry workspaces. Case-insensitive join on workspace_name.';

-- Rewrite the existing RPC as a thin wrapper so the
-- get-workspace-data edge function keeps working without a redeploy.
-- DROP first because Postgres cannot change a function's return-type
-- shape via CREATE OR REPLACE (the prior version on remote had a
-- subtly different row type).
DROP FUNCTION IF EXISTS public.get_user_workspaces(UUID);

CREATE OR REPLACE FUNCTION public.get_user_workspaces(p_user_id UUID)
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
BEGIN
  RETURN QUERY
  SELECT * FROM public.get_workspace_lead_counts(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_workspaces(UUID) TO authenticated;
