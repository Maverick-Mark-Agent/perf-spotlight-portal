-- =====================================================
-- Real-Time Data Sync Infrastructure Tables
-- Created: 2025-10-09
-- Purpose: Support real-time webhook tracking and email account caching
-- =====================================================

-- =====================================================
-- 1. SENDER_EMAILS_CACHE
-- Purpose: Store email account snapshots for fast access and historical tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sender_emails_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  email_address text NOT NULL,
  account_name text,
  workspace_name text NOT NULL,
  bison_workspace_id integer NOT NULL,
  bison_instance text NOT NULL, -- 'Maverick' or 'Long Run'

  -- Performance metrics (from Email Bison API)
  emails_sent_count integer DEFAULT 0,
  total_replied_count integer DEFAULT 0,
  unique_replied_count integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  unsubscribed_count integer DEFAULT 0,
  interested_leads_count integer DEFAULT 0,
  total_leads_contacted_count integer DEFAULT 0,

  -- Calculated metrics (generated column)
  reply_rate_percentage decimal(5,2) GENERATED ALWAYS AS (
    CASE WHEN emails_sent_count > 0
    THEN ROUND((unique_replied_count::decimal / emails_sent_count::decimal) * 100, 2)
    ELSE 0 END
  ) STORED,

  -- Status
  status text NOT NULL CHECK (status IN ('Connected', 'Disconnected', 'Failed', 'Not connected')),
  daily_limit integer DEFAULT 0,
  account_type text,

  -- Provider/Reseller info
  email_provider text, -- 'Gmail', 'Outlook', 'Microsoft', etc.
  reseller text,       -- 'CheapInboxes', 'Zapmail', 'ScaledMail', 'Mailr'
  domain text,

  -- Pricing (joined from email_account_metadata)
  price decimal(10,2),
  volume_per_account integer,

  -- Tags
  tags jsonb DEFAULT '[]'::jsonb,

  -- Timestamps
  last_synced_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(email_address, workspace_name)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_workspace ON public.sender_emails_cache(workspace_name);
CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_provider ON public.sender_emails_cache(email_provider);
CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_reseller ON public.sender_emails_cache(reseller);
CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_status ON public.sender_emails_cache(status);
CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_reply_rate ON public.sender_emails_cache(reply_rate_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_last_synced ON public.sender_emails_cache(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_bison_instance ON public.sender_emails_cache(bison_instance);
CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_email ON public.sender_emails_cache(email_address);

-- Enable Row Level Security
ALTER TABLE public.sender_emails_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (internal dashboard)
CREATE POLICY "Allow all operations on sender_emails_cache"
  ON public.sender_emails_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update timestamp trigger
CREATE TRIGGER set_updated_at_sender_emails_cache
  BEFORE UPDATE ON public.sender_emails_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.sender_emails_cache IS 'Cached email account data from Email Bison for fast access and historical tracking. Refreshed every 5 minutes via polling.';
COMMENT ON COLUMN public.sender_emails_cache.email_address IS 'Email account address';
COMMENT ON COLUMN public.sender_emails_cache.workspace_name IS 'Client workspace name';
COMMENT ON COLUMN public.sender_emails_cache.reply_rate_percentage IS 'Calculated reply rate: (unique_replied_count / emails_sent_count) * 100';
COMMENT ON COLUMN public.sender_emails_cache.last_synced_at IS 'Last time this account was synced from Email Bison API';

-- =====================================================
-- 2. PROVIDER_PERFORMANCE_HISTORY
-- Purpose: Track provider performance over time for trending analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS public.provider_performance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider info
  email_provider text NOT NULL, -- 'Gmail', 'Outlook', etc.
  bison_instance text NOT NULL, -- 'Maverick' or 'Long Run'

  -- Aggregate metrics
  total_accounts integer NOT NULL DEFAULT 0,
  active_accounts integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_replies integer NOT NULL DEFAULT 0,
  unique_replies integer NOT NULL DEFAULT 0,
  total_bounces integer NOT NULL DEFAULT 0,

  -- Calculated metrics
  avg_reply_rate decimal(5,2) NOT NULL DEFAULT 0,
  avg_emails_per_account decimal(10,2) DEFAULT 0,

  -- Sending capacity
  total_daily_limit integer DEFAULT 0,
  total_volume_capacity integer DEFAULT 0,
  utilization_percentage decimal(5,2) DEFAULT 0,

  -- Snapshot metadata
  snapshot_date date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(email_provider, bison_instance, snapshot_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_history_date ON public.provider_performance_history(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_provider_history_provider ON public.provider_performance_history(email_provider);
CREATE INDEX IF NOT EXISTS idx_provider_history_reply_rate ON public.provider_performance_history(avg_reply_rate DESC);
CREATE INDEX IF NOT EXISTS idx_provider_history_instance ON public.provider_performance_history(bison_instance);

-- Enable RLS
ALTER TABLE public.provider_performance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on provider_performance_history"
  ON public.provider_performance_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.provider_performance_history IS 'Daily snapshots of email provider performance for trending analysis (Gmail vs Outlook vs others)';
COMMENT ON COLUMN public.provider_performance_history.snapshot_date IS 'Date of this performance snapshot (one per day)';
COMMENT ON COLUMN public.provider_performance_history.avg_reply_rate IS 'Weighted average reply rate for this provider';

-- =====================================================
-- 3. WEBHOOK_DELIVERY_LOG
-- Purpose: Track all webhook deliveries for monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS public.webhook_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event details
  event_type text NOT NULL,
  workspace_name text,
  payload jsonb NOT NULL,

  -- Processing details
  processing_time_ms integer,
  success boolean NOT NULL DEFAULT false,
  error_message text,

  -- Timestamp
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_webhook_log_event_type ON public.webhook_delivery_log(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_log_workspace ON public.webhook_delivery_log(workspace_name);
CREATE INDEX IF NOT EXISTS idx_webhook_log_created_at ON public.webhook_delivery_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_log_success ON public.webhook_delivery_log(success);
CREATE INDEX IF NOT EXISTS idx_webhook_log_created_success ON public.webhook_delivery_log(created_at DESC, success);

-- Enable RLS
ALTER TABLE public.webhook_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on webhook_delivery_log"
  ON public.webhook_delivery_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.webhook_delivery_log IS 'Log of all webhook deliveries from Email Bison for monitoring and debugging';
COMMENT ON COLUMN public.webhook_delivery_log.event_type IS 'Type of webhook event (e.g., lead_interested, email_sent)';
COMMENT ON COLUMN public.webhook_delivery_log.processing_time_ms IS 'Time taken to process webhook in milliseconds';

-- =====================================================
-- 4. WEBHOOK_HEALTH
-- Purpose: Track webhook health metrics per workspace
-- =====================================================

CREATE TABLE IF NOT EXISTS public.webhook_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace identification
  workspace_name text UNIQUE NOT NULL,

  -- Health metrics
  last_webhook_at timestamp with time zone,
  webhook_count_24h integer DEFAULT 0,
  success_rate_24h decimal(5,2) DEFAULT 100.00,

  -- Status
  is_healthy boolean DEFAULT true,
  last_error_message text,

  -- Timestamps
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_health_workspace ON public.webhook_health(workspace_name);
CREATE INDEX IF NOT EXISTS idx_webhook_health_updated ON public.webhook_health(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_health_healthy ON public.webhook_health(is_healthy);
CREATE INDEX IF NOT EXISTS idx_webhook_health_last_webhook ON public.webhook_health(last_webhook_at DESC);

-- Enable RLS
ALTER TABLE public.webhook_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on webhook_health"
  ON public.webhook_health
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update timestamp trigger
CREATE TRIGGER set_updated_at_webhook_health
  BEFORE UPDATE ON public.webhook_health
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add comments
COMMENT ON TABLE public.webhook_health IS 'Per-workspace webhook health tracking for monitoring and alerting';
COMMENT ON COLUMN public.webhook_health.last_webhook_at IS 'Timestamp of most recent webhook received for this workspace';
COMMENT ON COLUMN public.webhook_health.success_rate_24h IS 'Percentage of successful webhooks in last 24 hours';
COMMENT ON COLUMN public.webhook_health.is_healthy IS 'Overall health status (false if success rate < 95% or no webhook in 10 min)';

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate provider performance aggregates
CREATE OR REPLACE FUNCTION public.aggregate_provider_stats()
RETURNS TABLE (
  email_provider text,
  bison_instance text,
  total_accounts bigint,
  active_accounts bigint,
  total_sent bigint,
  total_replies bigint,
  unique_replies bigint,
  total_bounces bigint,
  avg_reply_rate numeric,
  avg_emails_per_account numeric,
  total_daily_limit bigint,
  total_volume_capacity bigint,
  utilization_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sec.email_provider,
    sec.bison_instance,
    COUNT(*)::bigint as total_accounts,
    COUNT(*) FILTER (WHERE sec.status = 'Connected')::bigint as active_accounts,
    SUM(sec.emails_sent_count)::bigint as total_sent,
    SUM(sec.total_replied_count)::bigint as total_replies,
    SUM(sec.unique_replied_count)::bigint as unique_replies,
    SUM(sec.bounced_count)::bigint as total_bounces,
    CASE
      WHEN SUM(sec.emails_sent_count) > 0
      THEN ROUND((SUM(sec.unique_replied_count)::decimal / SUM(sec.emails_sent_count)::decimal) * 100, 2)
      ELSE 0
    END as avg_reply_rate,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND(SUM(sec.emails_sent_count)::decimal / COUNT(*)::decimal, 2)
      ELSE 0
    END as avg_emails_per_account,
    SUM(sec.daily_limit)::bigint as total_daily_limit,
    SUM(sec.volume_per_account)::bigint as total_volume_capacity,
    CASE
      WHEN SUM(sec.volume_per_account) > 0
      THEN ROUND((SUM(sec.daily_limit)::decimal / SUM(sec.volume_per_account)::decimal) * 100, 2)
      ELSE 0
    END as utilization_percentage
  FROM public.sender_emails_cache sec
  WHERE sec.email_provider IS NOT NULL
  GROUP BY sec.email_provider, sec.bison_instance;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.aggregate_provider_stats IS 'Calculate aggregate provider performance metrics from sender_emails_cache';

-- Function to get account status statistics
CREATE OR REPLACE FUNCTION public.get_account_status_stats()
RETURNS TABLE (
  total bigint,
  connected bigint,
  disconnected bigint,
  failed bigint,
  disconnect_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE status = 'Connected')::bigint as connected,
    COUNT(*) FILTER (WHERE status = 'Disconnected')::bigint as disconnected,
    COUNT(*) FILTER (WHERE status = 'Failed')::bigint as failed,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE status IN ('Disconnected', 'Failed'))::decimal / COUNT(*)::decimal) * 100, 2)
      ELSE 0
    END as disconnect_rate
  FROM public.sender_emails_cache;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_account_status_stats IS 'Get overall account status statistics';

-- Function to check for provider reply rate drops
CREATE OR REPLACE FUNCTION public.check_provider_reply_rate_drop()
RETURNS TABLE (
  email_provider text,
  bison_instance text,
  current_rate numeric,
  previous_rate numeric,
  drop_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH today_rates AS (
    SELECT
      pph.email_provider,
      pph.bison_instance,
      pph.avg_reply_rate
    FROM public.provider_performance_history pph
    WHERE pph.snapshot_date = CURRENT_DATE
  ),
  yesterday_rates AS (
    SELECT
      pph.email_provider,
      pph.bison_instance,
      pph.avg_reply_rate
    FROM public.provider_performance_history pph
    WHERE pph.snapshot_date = CURRENT_DATE - INTERVAL '1 day'
  )
  SELECT
    t.email_provider,
    t.bison_instance,
    t.avg_reply_rate as current_rate,
    y.avg_reply_rate as previous_rate,
    ROUND(((y.avg_reply_rate - t.avg_reply_rate) / NULLIF(y.avg_reply_rate, 0)) * 100, 2) as drop_percentage
  FROM today_rates t
  INNER JOIN yesterday_rates y
    ON t.email_provider = y.email_provider
    AND t.bison_instance = y.bison_instance
  WHERE y.avg_reply_rate > 0
    AND ((y.avg_reply_rate - t.avg_reply_rate) / y.avg_reply_rate) * 100 > 20;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.check_provider_reply_rate_drop IS 'Detect providers with >20% reply rate drop compared to previous day';

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant access to service role for Edge Functions
GRANT ALL ON public.sender_emails_cache TO service_role;
GRANT ALL ON public.provider_performance_history TO service_role;
GRANT ALL ON public.webhook_delivery_log TO service_role;
GRANT ALL ON public.webhook_health TO service_role;

-- Grant read access to authenticated users
GRANT SELECT ON public.sender_emails_cache TO authenticated;
GRANT SELECT ON public.provider_performance_history TO authenticated;
GRANT SELECT ON public.webhook_delivery_log TO authenticated;
GRANT SELECT ON public.webhook_health TO authenticated;

-- Grant access to anon role for frontend queries
GRANT SELECT ON public.sender_emails_cache TO anon;
GRANT SELECT ON public.provider_performance_history TO anon;
GRANT SELECT ON public.webhook_health TO anon;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.aggregate_provider_stats TO service_role;
GRANT EXECUTE ON FUNCTION public.get_account_status_stats TO service_role;
GRANT EXECUTE ON FUNCTION public.check_provider_reply_rate_drop TO service_role;

GRANT EXECUTE ON FUNCTION public.aggregate_provider_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_status_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_provider_reply_rate_drop TO authenticated;
