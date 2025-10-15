-- Create function to get daily billable lead revenue for current month
-- Returns time-series data showing cumulative revenue from per-lead clients only

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
      DATE(cl.date_received) as rev_date,
      SUM(cl.lead_value)::DECIMAL(10,2) as daily_rev,
      COUNT(*)::INTEGER as leads
    FROM client_leads cl
    JOIN client_registry cr ON cl.workspace_name = cr.workspace_name
    WHERE
      TO_CHAR(cl.date_received, 'YYYY-MM') = month_year
      AND cr.billing_type = 'per_lead'
      AND cr.is_active = true
    GROUP BY DATE(cl.date_received)
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

COMMENT ON FUNCTION public.get_daily_billable_revenue IS 'Returns daily cumulative billable lead revenue for per-lead clients only (excludes retainer revenue)';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_daily_billable_revenue TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_billable_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_billable_revenue TO anon;
