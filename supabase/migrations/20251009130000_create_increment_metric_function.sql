-- =====================================================
-- Create increment_metric RPC function
-- Purpose: Atomically increment metric counters from webhooks
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_metric(
  p_workspace_name text,
  p_metric_name text,
  p_increment_by integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_value integer;
BEGIN
  -- Get current value
  EXECUTE format('
    SELECT COALESCE(%I, 0)
    FROM public.client_metrics
    WHERE workspace_name = $1
      AND metric_type = ''mtd''
  ', p_metric_name)
  INTO v_current_value
  USING p_workspace_name;

  -- If no record exists, create it
  IF NOT FOUND OR v_current_value IS NULL THEN
    INSERT INTO public.client_metrics (
      workspace_name,
      metric_type,
      emails_sent_mtd,
      positive_replies_mtd,
      replies_mtd,
      bounced_mtd,
      unsubscribed_mtd
    )
    VALUES (
      p_workspace_name,
      'mtd',
      CASE WHEN p_metric_name = 'emails_sent_mtd' THEN p_increment_by ELSE 0 END,
      CASE WHEN p_metric_name = 'interested_mtd' THEN p_increment_by ELSE 0 END,
      CASE WHEN p_metric_name = 'replies_mtd' THEN p_increment_by ELSE 0 END,
      CASE WHEN p_metric_name = 'bounces_mtd' THEN p_increment_by ELSE 0 END,
      CASE WHEN p_metric_name = 'unsubscribes_mtd' THEN p_increment_by ELSE 0 END
    )
    ON CONFLICT (workspace_name, metric_type) DO UPDATE
    SET
      emails_sent_mtd = client_metrics.emails_sent_mtd + (
        CASE WHEN p_metric_name = 'emails_sent_mtd' THEN p_increment_by ELSE 0 END
      ),
      positive_replies_mtd = client_metrics.positive_replies_mtd + (
        CASE WHEN p_metric_name = 'interested_mtd' THEN p_increment_by ELSE 0 END
      ),
      replies_mtd = client_metrics.replies_mtd + (
        CASE WHEN p_metric_name = 'replies_mtd' THEN p_increment_by ELSE 0 END
      ),
      bounced_mtd = client_metrics.bounced_mtd + (
        CASE WHEN p_metric_name = 'bounces_mtd' THEN p_increment_by ELSE 0 END
      ),
      unsubscribed_mtd = client_metrics.unsubscribed_mtd + (
        CASE WHEN p_metric_name = 'unsubscribes_mtd' THEN p_increment_by ELSE 0 END
      ),
      updated_at = timezone('utc'::text, now());
  ELSE
    -- Update existing record
    EXECUTE format('
      UPDATE public.client_metrics
      SET %I = %I + $2,
          updated_at = timezone(''utc''::text, now())
      WHERE workspace_name = $1
        AND metric_type = ''mtd''
    ', p_metric_name, p_metric_name)
    USING p_workspace_name, p_increment_by;
  END IF;

  -- Also update realtime cache if it exists
  UPDATE public.data_cache_metadata
  SET last_updated = timezone('utc'::text, now())
  WHERE cache_key = 'client_metrics_' || p_workspace_name;

END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_metric(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_metric(text, text, integer) TO authenticated;

COMMENT ON FUNCTION public.increment_metric IS 'Atomically increment a metric counter for real-time webhook updates';
