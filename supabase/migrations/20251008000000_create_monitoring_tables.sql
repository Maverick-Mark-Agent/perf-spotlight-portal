-- =====================================================
-- DATA CONSISTENCY & MONITORING SYSTEM
-- =====================================================
-- Creates tables for tracking data freshness, API health,
-- and validation errors across the dashboard
-- =====================================================

-- =====================================================
-- 1. DATA CACHE METADATA
-- =====================================================
-- Tracks cache freshness and performance metrics

CREATE TABLE IF NOT EXISTS public.data_cache_metadata (
  cache_key TEXT PRIMARY KEY,

  -- Timestamps
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_fetch_duration_ms INTEGER,

  -- Data statistics
  record_count INTEGER DEFAULT 0,
  data_size_bytes INTEGER DEFAULT 0,

  -- Status tracking
  status TEXT CHECK (status IN ('fresh', 'stale', 'error', 'updating')) DEFAULT 'fresh',
  error_message TEXT,

  -- Versioning
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for cache metadata
CREATE INDEX idx_cache_metadata_status ON public.data_cache_metadata(status);
CREATE INDEX idx_cache_metadata_last_updated ON public.data_cache_metadata(last_updated DESC);

-- RLS policies
ALTER TABLE public.data_cache_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cache metadata"
  ON public.data_cache_metadata FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to cache metadata"
  ON public.data_cache_metadata FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.data_cache_metadata IS 'Tracks data freshness and cache metadata for all dashboards';

-- =====================================================
-- 2. API HEALTH LOGS
-- =====================================================
-- Monitors Email Bison API health and response times

CREATE TABLE IF NOT EXISTS public.api_health_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- API details
  api_name TEXT NOT NULL, -- 'Email Bison', 'Supabase', etc.
  endpoint TEXT NOT NULL,
  method TEXT DEFAULT 'GET',

  -- Response details
  status_code INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT false,

  -- Error tracking
  error_type TEXT, -- 'timeout', 'network', 'validation', '5xx', '4xx'
  error_message TEXT,
  error_stack TEXT,

  -- Context
  workspace_name TEXT,
  triggered_by TEXT, -- 'manual', 'auto-refresh', 'health-check'

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);

-- Indexes for API health logs
CREATE INDEX idx_api_health_api_name ON public.api_health_logs(api_name);
CREATE INDEX idx_api_health_timestamp ON public.api_health_logs(timestamp DESC);
CREATE INDEX idx_api_health_success ON public.api_health_logs(success);
CREATE INDEX idx_api_health_workspace ON public.api_health_logs(workspace_name);
CREATE INDEX idx_api_health_error_type ON public.api_health_logs(error_type) WHERE error_type IS NOT NULL;

-- Composite index for health monitoring queries
CREATE INDEX idx_api_health_monitoring ON public.api_health_logs(api_name, timestamp DESC, success);

-- RLS policies
ALTER TABLE public.api_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to recent API health logs"
  ON public.api_health_logs FOR SELECT
  USING (timestamp > NOW() - INTERVAL '7 days'); -- Only show last 7 days

CREATE POLICY "Allow service role full access to API health logs"
  ON public.api_health_logs FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.api_health_logs IS 'Tracks API health, response times, and errors for monitoring';

-- =====================================================
-- 3. DATA VALIDATION ERRORS
-- =====================================================
-- Logs validation errors from data integrity checks

CREATE TABLE IF NOT EXISTS public.data_validation_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Source identification
  source TEXT NOT NULL, -- 'KPI Dashboard', 'Volume Dashboard', etc.
  function_name TEXT, -- Edge function name
  workspace_name TEXT,

  -- Error details
  error_type TEXT NOT NULL, -- 'missing_field', 'invalid_type', 'range_error', 'schema_mismatch'
  field_name TEXT,
  expected_value TEXT,
  actual_value TEXT,
  error_message TEXT NOT NULL,
  error_details JSONB,

  -- Severity
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')) DEFAULT 'error',

  -- Resolution tracking
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by TEXT,
  resolution_notes TEXT,

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  occurrences INTEGER DEFAULT 1, -- Track duplicate errors
  first_occurrence TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_occurrence TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for validation errors
CREATE INDEX idx_validation_errors_source ON public.data_validation_errors(source);
CREATE INDEX idx_validation_errors_timestamp ON public.data_validation_errors(timestamp DESC);
CREATE INDEX idx_validation_errors_error_type ON public.data_validation_errors(error_type);
CREATE INDEX idx_validation_errors_severity ON public.data_validation_errors(severity);
CREATE INDEX idx_validation_errors_resolved ON public.data_validation_errors(resolved) WHERE NOT resolved;
CREATE INDEX idx_validation_errors_workspace ON public.data_validation_errors(workspace_name);

-- RLS policies
ALTER TABLE public.data_validation_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to validation errors"
  ON public.data_validation_errors FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to validation errors"
  ON public.data_validation_errors FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.data_validation_errors IS 'Logs data validation errors and schema mismatches';

-- =====================================================
-- 4. DASHBOARD HEALTH SUMMARY (VIEW)
-- =====================================================
-- Aggregates health data for monitoring dashboard

CREATE OR REPLACE VIEW public.dashboard_health_summary AS
SELECT
  -- Cache freshness
  (SELECT COUNT(*) FROM public.data_cache_metadata WHERE status = 'fresh') AS fresh_caches,
  (SELECT COUNT(*) FROM public.data_cache_metadata WHERE status = 'stale') AS stale_caches,
  (SELECT COUNT(*) FROM public.data_cache_metadata WHERE status = 'error') AS error_caches,

  -- API health (last hour)
  (SELECT COUNT(*) FROM public.api_health_logs WHERE timestamp > NOW() - INTERVAL '1 hour') AS api_calls_last_hour,
  (SELECT COUNT(*) FROM public.api_health_logs WHERE timestamp > NOW() - INTERVAL '1 hour' AND success = true) AS successful_api_calls,
  (SELECT AVG(response_time_ms) FROM public.api_health_logs WHERE timestamp > NOW() - INTERVAL '1 hour' AND success = true) AS avg_response_time_ms,

  -- Validation errors (last hour)
  (SELECT COUNT(*) FROM public.data_validation_errors WHERE timestamp > NOW() - INTERVAL '1 hour') AS validation_errors_last_hour,
  (SELECT COUNT(*) FROM public.data_validation_errors WHERE timestamp > NOW() - INTERVAL '1 hour' AND severity = 'critical') AS critical_errors_last_hour,

  -- Overall health score (0-100)
  CASE
    WHEN (SELECT COUNT(*) FROM public.data_cache_metadata WHERE status = 'error') > 0 THEN 30
    WHEN (SELECT COUNT(*) FROM public.api_health_logs WHERE timestamp > NOW() - INTERVAL '5 minutes' AND success = false) > 5 THEN 50
    WHEN (SELECT COUNT(*) FROM public.data_validation_errors WHERE timestamp > NOW() - INTERVAL '1 hour' AND severity = 'critical') > 0 THEN 60
    WHEN (SELECT COUNT(*) FROM public.data_cache_metadata WHERE status = 'stale') > 2 THEN 75
    ELSE 100
  END AS health_score,

  NOW() AS generated_at;

COMMENT ON VIEW public.dashboard_health_summary IS 'Real-time health summary for all dashboards';

-- Grant access to the view
GRANT SELECT ON public.dashboard_health_summary TO anon;
GRANT SELECT ON public.dashboard_health_summary TO authenticated;

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to log API health
CREATE OR REPLACE FUNCTION public.log_api_health(
  p_api_name TEXT,
  p_endpoint TEXT,
  p_status_code INTEGER,
  p_response_time_ms INTEGER,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_workspace_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.api_health_logs (
    api_name,
    endpoint,
    status_code,
    response_time_ms,
    success,
    error_message,
    workspace_name
  ) VALUES (
    p_api_name,
    p_endpoint,
    p_status_code,
    p_response_time_ms,
    p_success,
    p_error_message,
    p_workspace_name
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update cache metadata
CREATE OR REPLACE FUNCTION public.update_cache_metadata(
  p_cache_key TEXT,
  p_status TEXT,
  p_record_count INTEGER DEFAULT NULL,
  p_fetch_duration_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.data_cache_metadata (
    cache_key,
    status,
    record_count,
    last_fetch_duration_ms,
    error_message,
    last_updated
  ) VALUES (
    p_cache_key,
    p_status,
    p_record_count,
    p_fetch_duration_ms,
    p_error_message,
    NOW()
  )
  ON CONFLICT (cache_key) DO UPDATE SET
    status = p_status,
    record_count = COALESCE(EXCLUDED.record_count, data_cache_metadata.record_count),
    last_fetch_duration_ms = COALESCE(EXCLUDED.last_fetch_duration_ms, data_cache_metadata.last_fetch_duration_ms),
    error_message = EXCLUDED.error_message,
    last_updated = NOW(),
    version = data_cache_metadata.version + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log validation error
CREATE OR REPLACE FUNCTION public.log_validation_error(
  p_source TEXT,
  p_error_type TEXT,
  p_error_message TEXT,
  p_field_name TEXT DEFAULT NULL,
  p_workspace_name TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'error',
  p_error_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_error_id UUID;
BEGIN
  INSERT INTO public.data_validation_errors (
    source,
    error_type,
    error_message,
    field_name,
    workspace_name,
    severity,
    error_details
  ) VALUES (
    p_source,
    p_error_type,
    p_error_message,
    p_field_name,
    p_workspace_name,
    p_severity,
    p_error_details
  ) RETURNING id INTO v_error_id;

  RETURN v_error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. CLEANUP POLICIES (Auto-delete old data)
-- =====================================================

-- Create function to clean up old logs
CREATE OR REPLACE FUNCTION public.cleanup_old_monitoring_data()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete API health logs older than 30 days
  DELETE FROM public.api_health_logs WHERE timestamp < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Delete resolved validation errors older than 90 days
  DELETE FROM public.data_validation_errors
  WHERE resolved = true AND resolved_at < NOW() - INTERVAL '90 days';

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run daily at 3 AM (using pg_cron if available)
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-monitoring-data', '0 3 * * *', 'SELECT public.cleanup_old_monitoring_data()');

COMMENT ON FUNCTION public.cleanup_old_monitoring_data() IS 'Cleans up old monitoring data to prevent table bloat';

-- =====================================================
-- 7. INITIAL DATA SETUP
-- =====================================================

-- Insert initial cache metadata entries
INSERT INTO public.data_cache_metadata (cache_key, status, record_count, last_fetch_duration_ms)
VALUES
  ('kpi-dashboard-data', 'stale', 0, 0),
  ('volume-dashboard-data', 'stale', 0, 0),
  ('revenue-dashboard-data', 'stale', 0, 0),
  ('infrastructure-dashboard-data', 'stale', 0, 0)
ON CONFLICT (cache_key) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- All monitoring tables, views, and functions created successfully
