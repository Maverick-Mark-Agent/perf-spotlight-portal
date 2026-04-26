-- Update get_daily_billable_revenue to bucket by interested_at instead of
-- date_received. Pairs with 20260424120000_add_interested_at.sql so per-lead
-- billing reports count a lead in the month it first became interested,
-- regardless of later reply activity.
--
-- Also adds an explicit `interested = true` filter. The previous function
-- bucketed every client_leads row for per_lead/active clients, which included
-- non-interested leads. Billing should only count interested leads.

DROP FUNCTION IF EXISTS public.get_daily_billable_revenue(TEXT);

CREATE OR REPLACE FUNCTION public.get_daily_billable_revenue(month_year TEXT)
RETURNS TABLE (
  revenue_date DATE,
  daily_revenue DECIMAL(10,2),
  cumulative_revenue DECIMAL(10,2),
  lead_count INTEGER,
  day_of_month INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT
      DATE(cl.interested_at) as rev_date,
      SUM(cl.lead_value)::DECIMAL(10,2) as daily_rev,
      COUNT(*)::INTEGER as leads
    FROM client_leads cl
    JOIN client_registry cr ON cl.workspace_name = cr.workspace_name
    WHERE
      TO_CHAR(cl.interested_at, 'YYYY-MM') = month_year
      AND cl.interested = true
      AND cl.deleted_at IS NULL
      AND cr.billing_type = 'per_lead'
      AND cr.is_active = true
    GROUP BY DATE(cl.interested_at)
  )
  SELECT
    rev_date as revenue_date,
    daily_rev as daily_revenue,
    SUM(daily_rev) OVER (ORDER BY rev_date)::DECIMAL(10,2) as cumulative_revenue,
    leads as lead_count,
    EXTRACT(DAY FROM rev_date)::INTEGER as day_of_month
  FROM daily_data
  ORDER BY rev_date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_daily_billable_revenue IS 'Returns daily cumulative billable lead revenue for per-lead clients only (excludes retainer revenue). Buckets leads by interested_at, the immutable first-interested timestamp, not the mutable date_received (latest reply).';

GRANT EXECUTE ON FUNCTION public.get_daily_billable_revenue TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_billable_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_billable_revenue TO anon;
