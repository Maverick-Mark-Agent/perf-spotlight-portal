-- =====================================================
-- COMPLETE AIRTABLE REPLACEMENT SCHEMA
-- =====================================================
-- This migration creates a comprehensive schema in Supabase
-- to completely replace all Airtable data and functionality
-- =====================================================

-- =====================================================
-- 1. ENHANCE CLIENT_REGISTRY (Master Client Table)
-- =====================================================
-- Add all missing Airtable fields to client_registry

ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS monthly_sending_target INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS airtable_workspace_name TEXT; -- For migration reference

-- Add comments for new columns
COMMENT ON COLUMN public.client_registry.monthly_sending_target IS 'Monthly email sending volume target (replaces Airtable field)';
COMMENT ON COLUMN public.client_registry.payout IS 'Monthly payout amount (replaces Airtable Payout field)';
COMMENT ON COLUMN public.client_registry.airtable_workspace_name IS 'Workspace Name from Airtable for migration reference';

-- =====================================================
-- 2. CREATE CLIENT_METRICS (Time-Series KPI Data)
-- =====================================================
-- Stores daily/monthly metrics that change over time
-- This replaces Airtable's calculated fields

CREATE TABLE IF NOT EXISTS public.client_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES public.client_registry(workspace_name) ON DELETE CASCADE,

  -- Date range for this metric snapshot
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('daily', 'monthly', 'mtd')),

  -- Email Volume Metrics
  emails_sent INTEGER DEFAULT 0,
  emails_sent_mtd INTEGER DEFAULT 0,
  projection_emails_eom INTEGER DEFAULT 0,

  -- Lead/Reply Metrics
  positive_replies INTEGER DEFAULT 0,
  positive_replies_mtd INTEGER DEFAULT 0,
  positive_replies_last_7_days INTEGER DEFAULT 0,
  positive_replies_last_14_days INTEGER DEFAULT 0,
  positive_replies_last_30_days INTEGER DEFAULT 0,
  positive_replies_current_month INTEGER DEFAULT 0,
  positive_replies_last_month INTEGER DEFAULT 0,
  projection_positive_replies_eom INTEGER DEFAULT 0,

  -- Progress Percentages (calculated)
  mtd_leads_progress DECIMAL(5,2) DEFAULT 0.00, -- % of monthly target
  projection_replies_progress DECIMAL(5,2) DEFAULT 0.00, -- Projected % of target
  last_week_vs_week_before_progress DECIMAL(5,2) DEFAULT 0.00,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one record per workspace per date per type
  UNIQUE(workspace_name, metric_date, metric_type)
);

-- Indexes for client_metrics
CREATE INDEX idx_client_metrics_workspace ON public.client_metrics(workspace_name);
CREATE INDEX idx_client_metrics_date ON public.client_metrics(metric_date DESC);
CREATE INDEX idx_client_metrics_type ON public.client_metrics(metric_type);
CREATE INDEX idx_client_metrics_current_month ON public.client_metrics(metric_date DESC, metric_type) WHERE metric_type = 'monthly';

-- Auto-update trigger for client_metrics
CREATE OR REPLACE FUNCTION update_client_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER client_metrics_updated_at
  BEFORE UPDATE ON public.client_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_client_metrics_timestamp();

-- RLS for client_metrics
ALTER TABLE public.client_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to client_metrics"
  ON public.client_metrics FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to client_metrics"
  ON public.client_metrics FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 3. CREATE CAMPAIGNS TABLE (Replace Airtable Campaigns)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES public.client_registry(workspace_name) ON DELETE CASCADE,

  -- Campaign identifiers
  campaign_name TEXT NOT NULL,
  airtable_record_id TEXT UNIQUE, -- For migration

  -- Scheduling
  emails_scheduled_today INTEGER DEFAULT 0,
  emails_scheduled_tomorrow INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_name, campaign_name)
);

-- Indexes for campaigns
CREATE INDEX idx_campaigns_workspace ON public.campaigns(workspace_name);
CREATE INDEX idx_campaigns_active ON public.campaigns(is_active) WHERE is_active = true;

-- Auto-update trigger
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_client_metrics_timestamp();

-- RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to campaigns"
  ON public.campaigns FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to campaigns"
  ON public.campaigns FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- 4. CREATE VIEWS FOR EASY QUERYING
-- =====================================================

-- View: Latest metrics for each client
CREATE OR REPLACE VIEW public.client_latest_metrics AS
SELECT DISTINCT ON (workspace_name)
  workspace_name,
  metric_date,
  emails_sent_mtd,
  projection_emails_eom,
  positive_replies_mtd,
  positive_replies_last_7_days,
  positive_replies_last_30_days,
  projection_positive_replies_eom,
  mtd_leads_progress,
  projection_replies_progress,
  updated_at
FROM public.client_metrics
WHERE metric_type = 'mtd'
ORDER BY workspace_name, metric_date DESC, created_at DESC;

-- View: Complete client dashboard data (combines registry + latest metrics)
CREATE OR REPLACE VIEW public.client_dashboard_data AS
SELECT
  cr.workspace_id,
  cr.workspace_name,
  cr.display_name,
  cr.is_active,
  cr.billing_type,
  cr.price_per_lead,
  cr.retainer_amount,
  cr.monthly_kpi_target,
  cr.monthly_sending_target,
  cr.payout,
  clm.emails_sent_mtd,
  clm.projection_emails_eom,
  clm.positive_replies_mtd,
  clm.positive_replies_last_7_days,
  clm.positive_replies_last_30_days,
  clm.projection_positive_replies_eom,
  clm.mtd_leads_progress,
  clm.projection_replies_progress,
  clm.metric_date as last_metric_update
FROM public.client_registry cr
LEFT JOIN public.client_latest_metrics clm ON cr.workspace_name = clm.workspace_name
WHERE cr.is_active = true;

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to upsert daily metrics (called by sync jobs)
CREATE OR REPLACE FUNCTION public.upsert_client_daily_metrics(
  p_workspace_name TEXT,
  p_metric_date DATE,
  p_emails_sent INTEGER DEFAULT 0,
  p_positive_replies INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO public.client_metrics (
    workspace_name,
    metric_date,
    metric_type,
    emails_sent,
    positive_replies
  ) VALUES (
    p_workspace_name,
    p_metric_date,
    'daily',
    p_emails_sent,
    p_positive_replies
  )
  ON CONFLICT (workspace_name, metric_date, metric_type)
  DO UPDATE SET
    emails_sent = EXCLUDED.emails_sent,
    positive_replies = EXCLUDED.positive_replies,
    updated_at = NOW()
  RETURNING id INTO v_metric_id;

  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate and store MTD metrics
CREATE OR REPLACE FUNCTION public.calculate_mtd_metrics(
  p_workspace_name TEXT,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
  v_month_start DATE;
  v_emails_mtd INTEGER;
  v_replies_mtd INTEGER;
  v_replies_last_7 INTEGER;
  v_replies_last_30 INTEGER;
  v_monthly_target INTEGER;
  v_sending_target INTEGER;
  v_days_in_month INTEGER;
  v_current_day INTEGER;
  v_projection_emails INTEGER;
  v_projection_replies INTEGER;
  v_mtd_progress DECIMAL(5,2);
  v_projection_progress DECIMAL(5,2);
BEGIN
  -- Get month start
  v_month_start := DATE_TRUNC('month', p_as_of_date)::DATE;
  v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', p_as_of_date) + INTERVAL '1 month - 1 day'));
  v_current_day := EXTRACT(DAY FROM p_as_of_date);

  -- Get targets from client_registry
  SELECT monthly_kpi_target, monthly_sending_target
  INTO v_monthly_target, v_sending_target
  FROM public.client_registry
  WHERE workspace_name = p_workspace_name;

  -- Calculate MTD emails and replies
  SELECT
    COALESCE(SUM(emails_sent), 0),
    COALESCE(SUM(positive_replies), 0)
  INTO v_emails_mtd, v_replies_mtd
  FROM public.client_metrics
  WHERE workspace_name = p_workspace_name
    AND metric_type = 'daily'
    AND metric_date BETWEEN v_month_start AND p_as_of_date;

  -- Calculate last 7 days
  SELECT COALESCE(SUM(positive_replies), 0)
  INTO v_replies_last_7
  FROM public.client_metrics
  WHERE workspace_name = p_workspace_name
    AND metric_type = 'daily'
    AND metric_date BETWEEN (p_as_of_date - INTERVAL '7 days')::DATE AND p_as_of_date;

  -- Calculate last 30 days
  SELECT COALESCE(SUM(positive_replies), 0)
  INTO v_replies_last_30
  FROM public.client_metrics
  WHERE workspace_name = p_workspace_name
    AND metric_type = 'daily'
    AND metric_date BETWEEN (p_as_of_date - INTERVAL '30 days')::DATE AND p_as_of_date;

  -- Calculate projections (linear)
  IF v_current_day > 0 THEN
    v_projection_emails := ROUND((v_emails_mtd::DECIMAL / v_current_day) * v_days_in_month);
    v_projection_replies := ROUND((v_replies_mtd::DECIMAL / v_current_day) * v_days_in_month);
  ELSE
    v_projection_emails := 0;
    v_projection_replies := 0;
  END IF;

  -- Calculate progress percentages
  v_mtd_progress := CASE
    WHEN v_monthly_target > 0 THEN (v_replies_mtd::DECIMAL / v_monthly_target) * 100
    ELSE 0
  END;

  v_projection_progress := CASE
    WHEN v_monthly_target > 0 THEN (v_projection_replies::DECIMAL / v_monthly_target) * 100
    ELSE 0
  END;

  -- Upsert MTD record
  INSERT INTO public.client_metrics (
    workspace_name,
    metric_date,
    metric_type,
    emails_sent_mtd,
    positive_replies_mtd,
    positive_replies_last_7_days,
    positive_replies_last_30_days,
    projection_emails_eom,
    projection_positive_replies_eom,
    mtd_leads_progress,
    projection_replies_progress
  ) VALUES (
    p_workspace_name,
    p_as_of_date,
    'mtd',
    v_emails_mtd,
    v_replies_mtd,
    v_replies_last_7,
    v_replies_last_30,
    v_projection_emails,
    v_projection_replies,
    v_mtd_progress,
    v_projection_progress
  )
  ON CONFLICT (workspace_name, metric_date, metric_type)
  DO UPDATE SET
    emails_sent_mtd = EXCLUDED.emails_sent_mtd,
    positive_replies_mtd = EXCLUDED.positive_replies_mtd,
    positive_replies_last_7_days = EXCLUDED.positive_replies_last_7_days,
    positive_replies_last_30_days = EXCLUDED.positive_replies_last_30_days,
    projection_emails_eom = EXCLUDED.projection_emails_eom,
    projection_positive_replies_eom = EXCLUDED.projection_positive_replies_eom,
    mtd_leads_progress = EXCLUDED.mtd_leads_progress,
    projection_replies_progress = EXCLUDED.projection_replies_progress,
    updated_at = NOW()
  RETURNING id INTO v_metric_id;

  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE public.client_metrics IS 'Time-series metrics for all clients - replaces Airtable calculated fields. Updated daily by sync jobs.';
COMMENT ON TABLE public.campaigns IS 'Campaign scheduling and tracking - replaces Airtable Campaigns table';
COMMENT ON VIEW public.client_latest_metrics IS 'Latest MTD metrics for each client';
COMMENT ON VIEW public.client_dashboard_data IS 'Complete client data combining registry and latest metrics - use this for dashboards';
COMMENT ON FUNCTION public.upsert_client_daily_metrics IS 'Upsert daily metric snapshot for a client';
COMMENT ON FUNCTION public.calculate_mtd_metrics IS 'Calculate and store month-to-date metrics with projections';

-- Verify tables created
SELECT 'Airtable replacement schema created successfully!' as status;
