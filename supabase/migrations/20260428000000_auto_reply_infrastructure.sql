-- Auto-reply infrastructure: queue + skip log
--
-- Holds the scheduled-future work for the auto-reply system. The queue is
-- intentionally separate from sent_replies because rows here may not yet
-- have a generated draft — they're created at webhook time with only a
-- scheduled_for timestamp, then the worker fills in the draft + audit later.
--
-- Phase 1 = dark deploy. No row will ever be inserted unless
-- client_registry.auto_reply_enabled = TRUE on a workspace, which defaults
-- to FALSE everywhere.

CREATE TABLE IF NOT EXISTS public.auto_reply_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_uuid UUID NOT NULL UNIQUE REFERENCES public.lead_replies(id) ON DELETE CASCADE,
  workspace_name TEXT NOT NULL,

  -- Scheduling: when the worker should pick this up (in UTC).
  -- Computed by _shared/scheduling.ts to land within the workspace's
  -- Mon-Fri 7am-7pm local window, with the "human delay" floor applied.
  scheduled_for TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,

  -- State machine. See process-auto-reply-queue worker for transitions.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',          -- queued, not yet picked up
      'processing',       -- worker has it
      'review_required',  -- audit said human-eyes-needed
      'auto_sent',        -- auto-sent successfully
      'failed',           -- generation/audit/send error
      'cancelled'         -- human killed it before send (e.g. via Reject button)
    )),

  -- Generated draft + audit results (populated after worker pass).
  generated_reply_text TEXT,
  cc_emails TEXT[],
  audit_score INT,
  audit_verdict TEXT CHECK (audit_verdict IN ('auto_send', 'review', 'reject')),
  audit_reasoning TEXT,
  audit_issues JSONB,
  audit_model TEXT,
  generation_model TEXT,

  -- Result / errors
  sent_reply_id BIGINT REFERENCES public.sent_replies(id) ON DELETE SET NULL,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: worker query "find pending rows that are due now".
-- Partial index keeps it small even as the queue grows.
CREATE INDEX IF NOT EXISTS idx_auto_reply_queue_due
  ON public.auto_reply_queue(scheduled_for)
  WHERE status = 'pending';

-- UI path: count by workspace + status (review_required, auto_sent today, etc.)
CREATE INDEX IF NOT EXISTS idx_auto_reply_queue_workspace_status
  ON public.auto_reply_queue(workspace_name, status, updated_at DESC);

-- Auto-update updated_at on every change.
CREATE OR REPLACE FUNCTION public.update_auto_reply_queue_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_auto_reply_queue_updated_at ON public.auto_reply_queue;
CREATE TRIGGER set_auto_reply_queue_updated_at
  BEFORE UPDATE ON public.auto_reply_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_auto_reply_queue_updated_at();

-- Realtime so the "Awaiting Review" UI updates without polling.
ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_reply_queue;
ALTER TABLE public.auto_reply_queue REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────────────
-- auto_reply_skip_log: cheap audit of every reply we *considered* enqueueing
-- but skipped (eligibility check failed). Helps debug "why didn't this
-- auto-reply?" without spinning up a queue row.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auto_reply_skip_log (
  id BIGSERIAL PRIMARY KEY,
  reply_uuid UUID REFERENCES public.lead_replies(id) ON DELETE CASCADE,
  workspace_name TEXT NOT NULL,
  skip_reason TEXT NOT NULL,             -- e.g. 'auto_reply_disabled', 'low_confidence', 'no_template', 'no_timezone'
  skip_detail JSONB,                     -- contextual fields that informed the skip
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_skip_log_workspace
  ON public.auto_reply_skip_log(workspace_name, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────
-- Run after applying:
--   SELECT * FROM auto_reply_queue LIMIT 0;
--   SELECT * FROM auto_reply_skip_log LIMIT 0;
--   SELECT pubname FROM pg_publication_tables WHERE tablename = 'auto_reply_queue';
--   -- expect 'supabase_realtime'
