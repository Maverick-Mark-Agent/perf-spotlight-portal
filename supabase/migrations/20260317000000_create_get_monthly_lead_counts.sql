-- =====================================================
-- Create get_monthly_lead_counts RPC function
-- Purpose: Count interested leads per workspace for a date range
-- Uses SECURITY DEFINER to bypass RLS, returns grouped counts
-- to avoid PostgREST row limits on large client_leads queries
-- =====================================================

CREATE OR REPLACE FUNCTION get_monthly_lead_counts(p_start_date text, p_end_date text)
RETURNS TABLE(workspace_name text, lead_count bigint)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql STABLE AS $$
  SELECT cl.workspace_name, COUNT(*)::bigint
  FROM client_leads cl
  WHERE cl.interested = true
    AND cl.date_received >= p_start_date::timestamptz
    AND cl.date_received < p_end_date::timestamptz
  GROUP BY cl.workspace_name;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_lead_counts(text, text) TO anon, authenticated;

COMMENT ON FUNCTION get_monthly_lead_counts IS 'Count interested leads per workspace for a given date range. Used by KPI dashboard to get accurate lead counts.';
