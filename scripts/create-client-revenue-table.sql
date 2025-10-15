-- Direct SQL to create client_revenue_mtd table
-- Run this manually in Supabase SQL Editor if migration fails

DROP TABLE IF EXISTS public.client_revenue_mtd CASCADE;

CREATE TABLE public.client_revenue_mtd (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL,
  bison_workspace_id INTEGER,
  billing_type TEXT CHECK (billing_type IN ('per_lead', 'per-lead', 'retainer')),
  current_month_revenue NUMERIC(10, 2) DEFAULT 0,
  current_month_costs NUMERIC(10, 2) DEFAULT 0,
  current_month_profit NUMERIC(10, 2) DEFAULT 0,
  profit_margin NUMERIC(5, 2) DEFAULT 0,
  price_per_lead NUMERIC(10, 2),
  retainer_amount NUMERIC(10, 2),
  current_month_leads INTEGER DEFAULT 0,
  monthly_kpi INTEGER DEFAULT 0,
  kpi_progress NUMERIC(5, 2) DEFAULT 0,
  leads_remaining INTEGER DEFAULT 0,
  emails_sent_mtd INTEGER DEFAULT 0,
  replies_mtd INTEGER DEFAULT 0,
  interested_mtd INTEGER DEFAULT 0,
  bounces_mtd INTEGER DEFAULT 0,
  unsubscribes_mtd INTEGER DEFAULT 0,
  reply_rate NUMERIC(5, 2) DEFAULT 0,
  interested_rate NUMERIC(5, 2) DEFAULT 0,
  rank INTEGER,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(workspace_name, metric_date)
);

CREATE INDEX idx_client_revenue_mtd_date ON public.client_revenue_mtd(metric_date DESC);
CREATE INDEX idx_client_revenue_mtd_workspace ON public.client_revenue_mtd(workspace_name);
CREATE INDEX idx_client_revenue_mtd_rank ON public.client_revenue_mtd(rank);

ALTER TABLE public.client_revenue_mtd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.client_revenue_mtd;
CREATE POLICY "Allow authenticated read access" ON public.client_revenue_mtd FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read access" ON public.client_revenue_mtd;
CREATE POLICY "Allow anon read access" ON public.client_revenue_mtd FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow service role full access" ON public.client_revenue_mtd;
CREATE POLICY "Allow service role full access" ON public.client_revenue_mtd FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.client_revenue_mtd IS 'Cached revenue dashboard data populated by nightly cron job';
