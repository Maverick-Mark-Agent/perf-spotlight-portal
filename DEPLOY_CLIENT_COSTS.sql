-- ============================================
-- DEPLOY: client_costs table for Revenue Dashboard
-- ============================================
-- Copy this entire file and paste into Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

CREATE TABLE IF NOT EXISTS public.client_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL,
  month_year TEXT NOT NULL,
  email_account_costs DECIMAL(10,2) DEFAULT 0,
  labor_costs DECIMAL(10,2) DEFAULT 0,
  other_costs DECIMAL(10,2) DEFAULT 0,
  total_costs DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(email_account_costs, 0) +
    COALESCE(labor_costs, 0) +
    COALESCE(other_costs, 0)
  ) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(workspace_name, month_year)
);

CREATE INDEX IF NOT EXISTS idx_client_costs_workspace ON public.client_costs(workspace_name);
CREATE INDEX IF NOT EXISTS idx_client_costs_month ON public.client_costs(month_year);
CREATE INDEX IF NOT EXISTS idx_client_costs_workspace_month ON public.client_costs(workspace_name, month_year);

ALTER TABLE public.client_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on client_costs" ON public.client_costs;
CREATE POLICY "Allow all operations on client_costs"
  ON public.client_costs
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_client_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_client_costs_updated_at ON public.client_costs;
CREATE TRIGGER set_client_costs_updated_at
  BEFORE UPDATE ON public.client_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_costs_updated_at();

CREATE OR REPLACE FUNCTION public.get_current_month_year()
RETURNS TEXT AS $$
BEGIN
  RETURN TO_CHAR(CURRENT_DATE, 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.client_costs IS 'Monthly cost tracking per client for profitability analysis';
COMMENT ON COLUMN public.client_costs.month_year IS 'Month in YYYY-MM format';
COMMENT ON COLUMN public.client_costs.total_costs IS 'Auto-calculated sum of all cost categories';

-- Verify deployment
SELECT
  'SUCCESS: client_costs table created!' as status,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'client_costs') as table_exists;
