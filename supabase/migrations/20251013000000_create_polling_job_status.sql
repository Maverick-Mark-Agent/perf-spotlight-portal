-- Create table to track email polling job status
-- This helps identify when polling jobs timeout or fail to complete

CREATE TABLE IF NOT EXISTS public.polling_job_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'partial', 'failed')),

  -- Tracking metrics
  total_workspaces integer NOT NULL DEFAULT 0,
  workspaces_processed integer NOT NULL DEFAULT 0,
  workspaces_skipped integer NOT NULL DEFAULT 0,
  total_accounts_synced integer NOT NULL DEFAULT 0,

  -- Performance metrics
  duration_ms integer,

  -- Error tracking
  error_message text,
  warnings text[],

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_polling_job_status_job_name ON public.polling_job_status(job_name);
CREATE INDEX idx_polling_job_status_started_at ON public.polling_job_status(started_at DESC);
CREATE INDEX idx_polling_job_status_status ON public.polling_job_status(status);

-- Enable RLS
ALTER TABLE public.polling_job_status ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on polling_job_status"
ON public.polling_job_status
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon read access (for dashboard)
CREATE POLICY "Public read access on polling_job_status"
ON public.polling_job_status
FOR SELECT
TO anon
USING (true);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_polling_job_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_polling_job_status_timestamp ON public.polling_job_status;
CREATE TRIGGER update_polling_job_status_timestamp
BEFORE UPDATE ON public.polling_job_status
FOR EACH ROW
EXECUTE FUNCTION update_polling_job_status_timestamp();

-- Add helpful comment
COMMENT ON TABLE public.polling_job_status IS 'Tracks email polling job execution status and metrics. Updated by poll-sender-emails Edge Function.';
