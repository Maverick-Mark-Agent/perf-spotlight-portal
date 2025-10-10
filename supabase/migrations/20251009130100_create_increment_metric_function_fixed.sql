-- =====================================================
-- Create increment_metric RPC function (CORRECTED)
-- Purpose: Atomically increment metric counters from webhooks
-- Fixed to match actual client_metrics schema
-- =====================================================

-- First, add missing columns to client_metrics table
ALTER TABLE public.client_metrics
ADD COLUMN IF NOT EXISTS all_replies_mtd INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bounced_mtd INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unsubscribed_mtd INTEGER DEFAULT 0;

-- Create the increment function
CREATE OR REPLACE FUNCTION public.increment_metric(
  p_workspace_name text,
  p_metric_name text,
  p_increment_by integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Upsert the metric increment
  -- Using metric_type = 'mtd' and metric_date = CURRENT_DATE
  INSERT INTO public.client_metrics (
    workspace_name,
    metric_date,
    metric_type,
    emails_sent_mtd,
    positive_replies_mtd,
    all_replies_mtd,
    bounced_mtd,
    unsubscribed_mtd
  )
  VALUES (
    p_workspace_name,
    CURRENT_DATE,
    'mtd',
    CASE WHEN p_metric_name = 'emails_sent_mtd' THEN p_increment_by ELSE 0 END,
    CASE WHEN p_metric_name = 'interested_mtd' THEN p_increment_by ELSE 0 END,
    CASE WHEN p_metric_name = 'replies_mtd' THEN p_increment_by ELSE 0 END,
    CASE WHEN p_metric_name = 'bounces_mtd' THEN p_increment_by ELSE 0 END,
    CASE WHEN p_metric_name = 'unsubscribes_mtd' THEN p_increment_by ELSE 0 END
  )
  ON CONFLICT (workspace_name, metric_date, metric_type) DO UPDATE
  SET
    emails_sent_mtd = public.client_metrics.emails_sent_mtd + (
      CASE WHEN p_metric_name = 'emails_sent_mtd' THEN p_increment_by ELSE 0 END
    ),
    positive_replies_mtd = public.client_metrics.positive_replies_mtd + (
      CASE WHEN p_metric_name = 'interested_mtd' THEN p_increment_by ELSE 0 END
    ),
    all_replies_mtd = public.client_metrics.all_replies_mtd + (
      CASE WHEN p_metric_name = 'replies_mtd' THEN p_increment_by ELSE 0 END
    ),
    bounced_mtd = public.client_metrics.bounced_mtd + (
      CASE WHEN p_metric_name = 'bounces_mtd' THEN p_increment_by ELSE 0 END
    ),
    unsubscribed_mtd = public.client_metrics.unsubscribed_mtd + (
      CASE WHEN p_metric_name = 'unsubscribes_mtd' THEN p_increment_by ELSE 0 END
    ),
    updated_at = timezone('utc'::text, now());

  -- Also update realtime cache if it exists
  UPDATE public.data_cache_metadata
  SET last_updated = timezone('utc'::text, now())
  WHERE cache_key = 'client_metrics_' || p_workspace_name;

END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_metric(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_metric(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_metric(text, text, integer) TO anon;

COMMENT ON FUNCTION public.increment_metric IS 'Atomically increment a metric counter for real-time webhook updates. Uses metric_type=mtd and metric_date=CURRENT_DATE';
