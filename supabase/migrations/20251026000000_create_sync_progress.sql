-- ============================================================================
-- SYNC PROGRESS TRACKING TABLE
-- ============================================================================
-- Purpose: Track real-time progress of email account sync jobs
-- Used by: poll-sender-emails Edge Function + Frontend Progress Bar
-- Created: 2025-10-26
-- ============================================================================

-- Create sync progress tracking table
CREATE TABLE IF NOT EXISTS public.sync_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job identification
  job_id UUID NOT NULL,
  job_name TEXT NOT NULL,

  -- Progress metrics
  total_workspaces INTEGER NOT NULL DEFAULT 0,
  workspaces_completed INTEGER DEFAULT 0,
  current_workspace TEXT,
  total_accounts INTEGER DEFAULT 0,

  -- Status tracking
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sync_progress_job_id ON public.sync_progress(job_id);
CREATE INDEX IF NOT EXISTS idx_sync_progress_status ON public.sync_progress(status);
CREATE INDEX IF NOT EXISTS idx_sync_progress_started ON public.sync_progress(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_progress_job_name ON public.sync_progress(job_name, started_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.sync_progress ENABLE ROW LEVEL SECURITY;

-- Allow public read access (needed for real-time subscriptions from frontend)
CREATE POLICY "Public read access on sync_progress"
ON public.sync_progress
FOR SELECT
USING (true);

-- Service role full access (for Edge Function updates)
CREATE POLICY "Service role full access on sync_progress"
ON public.sync_progress
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Anon role read access (for authenticated dashboard users)
CREATE POLICY "Anon read access on sync_progress"
ON public.sync_progress
FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sync_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sync_progress_updated_at ON public.sync_progress;
CREATE TRIGGER set_sync_progress_updated_at
BEFORE UPDATE ON public.sync_progress
FOR EACH ROW
EXECUTE FUNCTION update_sync_progress_timestamp();

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================

-- Function to cleanup old progress records (keep last 24 hours only)
CREATE OR REPLACE FUNCTION cleanup_old_sync_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.sync_progress
  WHERE started_at < NOW() - INTERVAL '24 hours';

  RAISE NOTICE 'Cleaned up old sync_progress records';
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.sync_progress IS 'Real-time progress tracking for email account sync jobs. Enables frontend progress bars via Supabase Realtime.';
COMMENT ON COLUMN public.sync_progress.job_id IS 'Unique identifier for this sync job (matches polling_job_status.id)';
COMMENT ON COLUMN public.sync_progress.job_name IS 'Name of the sync job (e.g., "poll-sender-emails")';
COMMENT ON COLUMN public.sync_progress.current_workspace IS 'Name of workspace currently being synced';
COMMENT ON COLUMN public.sync_progress.total_accounts IS 'Running total of accounts synced so far';
COMMENT ON FUNCTION cleanup_old_sync_progress IS 'Cleanup function - remove progress records older than 24 hours';

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON public.sync_progress TO anon;
GRANT SELECT ON public.sync_progress TO authenticated;
GRANT ALL ON public.sync_progress TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_sync_progress TO service_role;
