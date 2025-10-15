-- Create client_revenue_mtd table for caching revenue dashboard data
-- Populated by sync-daily-kpi-metrics cron job (runs at midnight)

CREATE TABLE IF NOT EXISTS public.client_revenue_mtd (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL,
  bison_workspace_id INTEGER,
  billing_type TEXT CHECK (billing_type IN ('per_lead', 'per-lead', 'retainer')),

  -- Revenue metrics (MTD)
  current_month_revenue NUMERIC(10, 2) DEFAULT 0,
  current_month_costs NUMERIC(10, 2) DEFAULT 0,
  current_month_profit NUMERIC(10, 2) DEFAULT 0,
  profit_margin NUMERIC(5, 2) DEFAULT 0, -- Percentage
  price_per_lead NUMERIC(10, 2),
  retainer_amount NUMERIC(10, 2),

  -- KPI metrics (MTD)
  current_month_leads INTEGER DEFAULT 0,
  monthly_kpi INTEGER DEFAULT 0,
  kpi_progress NUMERIC(5, 2) DEFAULT 0, -- Percentage
  leads_remaining INTEGER DEFAULT 0,

  -- Email performance metrics (MTD)
  emails_sent_mtd INTEGER DEFAULT 0,
  replies_mtd INTEGER DEFAULT 0,
  interested_mtd INTEGER DEFAULT 0,
  bounces_mtd INTEGER DEFAULT 0,
  unsubscribes_mtd INTEGER DEFAULT 0,
  reply_rate NUMERIC(5, 2) DEFAULT 0, -- Percentage
  interested_rate NUMERIC(5, 2) DEFAULT 0, -- Percentage

  -- Metadata
  rank INTEGER,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sync_error TEXT, -- Store any errors from syncing this client
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Ensure one record per client per date
  UNIQUE(workspace_name, metric_date)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_client_revenue_mtd_date ON public.client_revenue_mtd(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_revenue_mtd_workspace ON public.client_revenue_mtd(workspace_name);
CREATE INDEX IF NOT EXISTS idx_client_revenue_mtd_rank ON public.client_revenue_mtd(rank);

-- RLS policies (allow read for authenticated users)
ALTER TABLE public.client_revenue_mtd ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.client_revenue_mtd
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read access" ON public.client_revenue_mtd
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow service role full access" ON public.client_revenue_mtd
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_client_revenue_mtd_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_client_revenue_mtd_updated_at
  BEFORE UPDATE ON public.client_revenue_mtd
  FOR EACH ROW
  EXECUTE FUNCTION update_client_revenue_mtd_updated_at();

-- Comments
COMMENT ON TABLE public.client_revenue_mtd IS 'Cached revenue dashboard data populated by nightly cron job';
COMMENT ON COLUMN public.client_revenue_mtd.metric_date IS 'Date these metrics were calculated (matches sync date)';
COMMENT ON COLUMN public.client_revenue_mtd.sync_error IS 'Error message if sync failed for this client';
