-- Create Revenue Management Tables
-- For tracking client pricing, costs, and profitability

-- ============================================
-- 1. CLIENT PRICING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Client identification (matches workspace_name from KPI dashboard)
  workspace_name TEXT UNIQUE NOT NULL,

  -- Billing configuration
  billing_type TEXT NOT NULL CHECK (billing_type IN ('per_lead', 'retainer')),
  price_per_lead DECIMAL(10,2) DEFAULT 0,
  retainer_amount DECIMAL(10,2) DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_pricing_workspace ON public.client_pricing(workspace_name);
CREATE INDEX IF NOT EXISTS idx_client_pricing_type ON public.client_pricing(billing_type);
CREATE INDEX IF NOT EXISTS idx_client_pricing_active ON public.client_pricing(is_active);

-- Enable RLS
ALTER TABLE public.client_pricing ENABLE ROW LEVEL SECURITY;

-- Allow all operations (will restrict with client auth later)
DROP POLICY IF EXISTS "Allow all operations on client_pricing" ON public.client_pricing;
CREATE POLICY "Allow all operations on client_pricing"
  ON public.client_pricing
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_client_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_client_pricing_updated_at ON public.client_pricing;
CREATE TRIGGER set_client_pricing_updated_at
  BEFORE UPDATE ON public.client_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_pricing_updated_at();

-- ============================================
-- 2. CLIENT COSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Client and time period
  workspace_name TEXT NOT NULL REFERENCES public.client_pricing(workspace_name) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: "2025-10"

  -- Cost breakdown
  email_account_costs DECIMAL(10,2) DEFAULT 0,
  labor_costs DECIMAL(10,2) DEFAULT 0,
  other_costs DECIMAL(10,2) DEFAULT 0,
  total_costs DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(email_account_costs, 0) +
    COALESCE(labor_costs, 0) +
    COALESCE(other_costs, 0)
  ) STORED,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Ensure one cost record per client per month
  UNIQUE(workspace_name, month_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_costs_workspace ON public.client_costs(workspace_name);
CREATE INDEX IF NOT EXISTS idx_client_costs_month ON public.client_costs(month_year);
CREATE INDEX IF NOT EXISTS idx_client_costs_workspace_month ON public.client_costs(workspace_name, month_year);

-- Enable RLS
ALTER TABLE public.client_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on client_costs" ON public.client_costs;
CREATE POLICY "Allow all operations on client_costs"
  ON public.client_costs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update trigger
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

-- ============================================
-- 3. MONTHLY REVENUE SNAPSHOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.monthly_revenue_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Client and time period
  workspace_name TEXT NOT NULL,
  month_year TEXT NOT NULL, -- Format: "2025-10"

  -- Snapshot data
  billable_leads INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  costs DECIMAL(10,2) DEFAULT 0,
  profit DECIMAL(10,2) DEFAULT 0,
  profit_margin_percentage DECIMAL(5,2) DEFAULT 0,

  -- When this snapshot was taken
  snapshot_date DATE DEFAULT CURRENT_DATE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Ensure one snapshot per client per month
  UNIQUE(workspace_name, month_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_workspace ON public.monthly_revenue_snapshots(workspace_name);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_month ON public.monthly_revenue_snapshots(month_year);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_date ON public.monthly_revenue_snapshots(snapshot_date DESC);

-- Enable RLS
ALTER TABLE public.monthly_revenue_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on monthly_revenue_snapshots" ON public.monthly_revenue_snapshots;
CREATE POLICY "Allow all operations on monthly_revenue_snapshots"
  ON public.monthly_revenue_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Function to get current month_year format
CREATE OR REPLACE FUNCTION public.get_current_month_year()
RETURNS TEXT AS $$
BEGIN
  RETURN TO_CHAR(CURRENT_DATE, 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

-- Function to get last month_year format
CREATE OR REPLACE FUNCTION public.get_last_month_year()
RETURNS TEXT AS $$
BEGIN
  RETURN TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.client_pricing IS 'Client billing configuration: per-lead pricing or monthly retainer';
COMMENT ON TABLE public.client_costs IS 'Monthly cost tracking per client for profitability analysis';
COMMENT ON TABLE public.monthly_revenue_snapshots IS 'Historical monthly revenue snapshots for trend analysis';

COMMENT ON COLUMN public.client_pricing.billing_type IS 'Type of billing: per_lead or retainer';
COMMENT ON COLUMN public.client_pricing.price_per_lead IS 'Price charged per billable lead (for per_lead clients)';
COMMENT ON COLUMN public.client_pricing.retainer_amount IS 'Fixed monthly retainer amount (for retainer clients)';

COMMENT ON COLUMN public.client_costs.month_year IS 'Month in YYYY-MM format';
COMMENT ON COLUMN public.client_costs.total_costs IS 'Auto-calculated sum of all cost categories';

COMMENT ON COLUMN public.monthly_revenue_snapshots.snapshot_date IS 'Date when this snapshot was taken';

-- Verify table creation
SELECT
  'Revenue tables created successfully!' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_pricing') as pricing_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_costs') as costs_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_revenue_snapshots') as snapshots_table;
