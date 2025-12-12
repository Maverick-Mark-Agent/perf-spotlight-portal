-- Create email accounts caching infrastructure
-- This enables reliable background syncing with Email Bison API

-- ============================================
-- TABLE 1: email_accounts_cache (Background/Source of Truth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_accounts_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email Bison Identifiers
  email_address TEXT NOT NULL UNIQUE,
  bison_id INTEGER NOT NULL,
  workspace_id INTEGER NOT NULL,
  workspace_name TEXT NOT NULL,
  bison_instance TEXT NOT NULL, -- 'Maverick' | 'Long Run'

  -- Complete Email Bison Data (stored as JSONB for flexibility)
  account_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Sync Metadata
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'success', -- 'success' | 'partial' | 'failed'
  sync_error TEXT, -- Error message if sync failed

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_email_cache_workspace
  ON public.email_accounts_cache(workspace_id);

CREATE INDEX IF NOT EXISTS idx_email_cache_workspace_name
  ON public.email_accounts_cache(workspace_name);

CREATE INDEX IF NOT EXISTS idx_email_cache_instance
  ON public.email_accounts_cache(bison_instance);

CREATE INDEX IF NOT EXISTS idx_email_cache_synced
  ON public.email_accounts_cache(last_synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_cache_sync_status
  ON public.email_accounts_cache(sync_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_cache_email
  ON public.email_accounts_cache(email_address);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_email_cache_account_data
  ON public.email_accounts_cache USING GIN (account_data);

-- ============================================
-- TABLE 2: email_sync_logs (Monitoring & Debugging)
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sync Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Sync Results
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'partial' | 'failed'
  total_accounts_fetched INTEGER DEFAULT 0,
  total_instances_processed INTEGER DEFAULT 0,
  total_workspaces_processed INTEGER DEFAULT 0,
  workspaces_failed TEXT[], -- Array of workspace names that failed

  -- Error Details
  error_message TEXT,
  error_details JSONB,

  -- Summary Stats
  summary JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  triggered_by TEXT DEFAULT 'cron', -- 'cron' | 'manual' | 'api'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_email_sync_logs_started
  ON public.email_sync_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_sync_logs_status
  ON public.email_sync_logs(status);

-- ============================================
-- MATERIALIZED VIEW: email_accounts_live (Fast Dashboard Reads)
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.email_accounts_live AS
SELECT
  id,
  email_address,
  bison_id,
  workspace_id,
  workspace_name,
  bison_instance,
  account_data,
  last_synced_at,
  sync_status,
  created_at,
  updated_at
FROM public.email_accounts_cache
WHERE
  sync_status = 'success'
  AND last_synced_at > NOW() - INTERVAL '2 hours'; -- Only show data synced within last 2 hours

-- Create unique index on materialized view for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_live_id
  ON public.email_accounts_live(id);

CREATE INDEX IF NOT EXISTS idx_email_live_workspace
  ON public.email_accounts_live(workspace_name);

CREATE INDEX IF NOT EXISTS idx_email_live_instance
  ON public.email_accounts_live(bison_instance);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION public.refresh_email_accounts_live()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use CONCURRENTLY to avoid locking the view during refresh
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.email_accounts_live;

  -- Log the refresh
  RAISE NOTICE 'Materialized view email_accounts_live refreshed at %', NOW();
END;
$$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_email_cache_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function to cleanup old sync logs (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_email_sync_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete logs older than 30 days
  DELETE FROM public.email_sync_logs
  WHERE started_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % old email sync logs', deleted_count;
  RETURN deleted_count;
END;
$$;

-- Function to get sync health status
CREATE OR REPLACE FUNCTION public.get_email_sync_health()
RETURNS TABLE (
  last_sync_time TIMESTAMPTZ,
  last_sync_status TEXT,
  total_accounts INTEGER,
  accounts_by_instance JSONB,
  minutes_since_last_sync INTEGER,
  is_healthy BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH latest_sync AS (
    SELECT
      started_at,
      status,
      total_accounts_fetched
    FROM public.email_sync_logs
    WHERE status IN ('success', 'partial')
    ORDER BY started_at DESC
    LIMIT 1
  ),
  instance_counts AS (
    SELECT
      jsonb_object_agg(
        bison_instance,
        count
      ) AS counts
    FROM (
      SELECT
        bison_instance,
        COUNT(*) AS count
      FROM public.email_accounts_cache
      WHERE sync_status = 'success'
      GROUP BY bison_instance
    ) t
  )
  SELECT
    ls.started_at AS last_sync_time,
    ls.status AS last_sync_status,
    (SELECT COUNT(*)::INTEGER FROM public.email_accounts_cache WHERE sync_status = 'success') AS total_accounts,
    COALESCE(ic.counts, '{}'::jsonb) AS accounts_by_instance,
    EXTRACT(EPOCH FROM (NOW() - ls.started_at))::INTEGER / 60 AS minutes_since_last_sync,
    (EXTRACT(EPOCH FROM (NOW() - ls.started_at))::INTEGER / 60 < 60) AS is_healthy -- Healthy if synced within last hour
  FROM latest_sync ls
  CROSS JOIN instance_counts ic;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to auto-update updated_at on email_accounts_cache
CREATE TRIGGER trigger_update_email_cache_timestamp
  BEFORE UPDATE ON public.email_accounts_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_cache_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on tables
ALTER TABLE public.email_accounts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now - adjust based on auth requirements)
CREATE POLICY "Allow all operations on email_accounts_cache"
  ON public.email_accounts_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on email_sync_logs"
  ON public.email_sync_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE public.email_accounts_cache IS
  'Background cache of all Email Bison email accounts. Updated by cron job every 30 minutes.';

COMMENT ON TABLE public.email_sync_logs IS
  'Audit log of all Email Bison sync operations. Used for monitoring and debugging.';

COMMENT ON MATERIALIZED VIEW public.email_accounts_live IS
  'Materialized view of successfully synced email accounts. Used by dashboard for fast queries.';

COMMENT ON COLUMN public.email_accounts_cache.account_data IS
  'Complete Email Bison account data stored as JSONB for flexibility and future-proofing.';

COMMENT ON COLUMN public.email_accounts_cache.sync_status IS
  'Status of last sync attempt: success (complete), partial (some data missing), failed (sync error).';

COMMENT ON FUNCTION public.refresh_email_accounts_live() IS
  'Refreshes the materialized view with latest data from cache. Called after successful sync.';

COMMENT ON FUNCTION public.get_email_sync_health() IS
  'Returns health status of email sync system including last sync time and account counts.';

-- ============================================
-- INITIAL DATA & VERIFICATION
-- ============================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Email accounts cache infrastructure created successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - email_accounts_cache (background sync)';
  RAISE NOTICE '  - email_sync_logs (monitoring)';
  RAISE NOTICE '  - email_accounts_live (materialized view)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Deploy sync-email-accounts-cache Edge Function';
  RAISE NOTICE '  2. Setup cron job for 30-minute sync';
  RAISE NOTICE '  3. Run initial sync to populate cache';
  RAISE NOTICE '========================================';
END $$;
