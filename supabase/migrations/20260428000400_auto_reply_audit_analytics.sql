-- Audit-pattern analytics for auto-reply.
--
-- Two RPC functions back the /auto-reply-analytics dashboard:
--   1. auto_reply_overall_stats   — pipeline counters (auto_sent / approved / rejected / pending)
--   2. auto_reply_issue_patterns  — per-(issue_type, severity) approval rates
--
-- Both accept an optional `p_since` cutoff so the dashboard can window to
-- "last 7 days", "last 30 days", or "all time".
--
-- Design notes:
-- * `audit_issues` is a JSONB array. Original audit issues live there alongside
--   `manually_approved` / `manually_rejected` sentinel entries appended when a
--   human acts on a review-queue item. We strip the sentinels for issue-pattern
--   counting but use them to determine terminal_state.
-- * `audit_auto_sent` = audit said send, system sent (no human in loop).
--   `human_approved_as_is` = audit flagged for review, human clicked Approve.
--   `human_approved_with_edits` = same but the rep edited the draft text first.
--   `human_rejected` = audit flagged for review, human clicked Reject.
--   `audit_rejected` = audit verdict was reject (score < 65), worker marked failed.

-- Helper: classify a queue row into a terminal state.
CREATE OR REPLACE FUNCTION public._auto_reply_terminal_state(
  p_status TEXT,
  p_audit_issues JSONB,
  p_error_message TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'auto_sent' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_audit_issues, '[]'::jsonb)) AS i
      WHERE i->>'type' = 'manually_approved'
        AND i->>'detail' ILIKE '%after edit%'
    ) THEN 'human_approved_with_edits'
    WHEN p_status = 'auto_sent' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_audit_issues, '[]'::jsonb)) AS i
      WHERE i->>'type' = 'manually_approved'
    ) THEN 'human_approved_as_is'
    WHEN p_status = 'auto_sent' THEN 'audit_auto_sent'
    WHEN p_status = 'cancelled' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_audit_issues, '[]'::jsonb)) AS i
      WHERE i->>'type' = 'manually_rejected'
    ) THEN 'human_rejected'
    WHEN p_status = 'cancelled' THEN 'cancelled_other'
    WHEN p_status = 'failed' AND p_error_message LIKE 'audit rejected%' THEN 'audit_rejected'
    WHEN p_status = 'failed' THEN 'system_error'
    WHEN p_status = 'review_required' THEN 'pending_review'
    ELSE 'in_progress'
  END;
$$;

-- =====================================================================
-- 1. Overall pipeline counters
-- =====================================================================
CREATE OR REPLACE FUNCTION public.auto_reply_overall_stats(
  p_since TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  terminal_state TEXT,
  count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public._auto_reply_terminal_state(status, audit_issues, error_message) AS terminal_state,
    COUNT(*)::BIGINT
  FROM public.auto_reply_queue
  WHERE p_since IS NULL OR updated_at >= p_since
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.auto_reply_overall_stats(TIMESTAMPTZ) IS
  'Pipeline counters for the auto-reply system, optionally windowed by p_since. One row per terminal state.';

-- =====================================================================
-- 2. Per-issue-type approval patterns
-- =====================================================================
CREATE OR REPLACE FUNCTION public.auto_reply_issue_patterns(
  p_since TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  issue_type TEXT,
  severity TEXT,
  times_flagged BIGINT,
  audit_auto_sent BIGINT,
  human_approved_as_is BIGINT,
  human_approved_with_edits BIGINT,
  human_rejected BIGINT,
  audit_rejected BIGINT,
  pending_review BIGINT,
  human_approval_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH flat AS (
    SELECT
      iss->>'type' AS issue_type,
      iss->>'severity' AS severity,
      public._auto_reply_terminal_state(arq.status, arq.audit_issues, arq.error_message) AS terminal_state
    FROM public.auto_reply_queue arq,
         LATERAL jsonb_array_elements(COALESCE(arq.audit_issues, '[]'::jsonb)) AS iss
    WHERE (p_since IS NULL OR arq.updated_at >= p_since)
      AND iss->>'type' NOT IN ('manually_approved', 'manually_rejected')
      AND iss->>'type' IS NOT NULL
  )
  SELECT
    issue_type,
    severity,
    COUNT(*)::BIGINT AS times_flagged,
    COUNT(*) FILTER (WHERE terminal_state = 'audit_auto_sent')::BIGINT AS audit_auto_sent,
    COUNT(*) FILTER (WHERE terminal_state = 'human_approved_as_is')::BIGINT AS human_approved_as_is,
    COUNT(*) FILTER (WHERE terminal_state = 'human_approved_with_edits')::BIGINT AS human_approved_with_edits,
    COUNT(*) FILTER (WHERE terminal_state = 'human_rejected')::BIGINT AS human_rejected,
    COUNT(*) FILTER (WHERE terminal_state = 'audit_rejected')::BIGINT AS audit_rejected,
    COUNT(*) FILTER (WHERE terminal_state = 'pending_review')::BIGINT AS pending_review,
    -- Approval rate: of the cases where a HUMAN was forced to act (review queue),
    -- what fraction did they approve? This is the actionable signal — high
    -- approval rate = audit is over-flagging this issue type.
    -- NULL when no human action data exists yet.
    CASE
      WHEN COUNT(*) FILTER (
        WHERE terminal_state IN ('human_approved_as_is', 'human_approved_with_edits', 'human_rejected')
      ) = 0 THEN NULL
      ELSE
        ROUND(
          COUNT(*) FILTER (
            WHERE terminal_state IN ('human_approved_as_is', 'human_approved_with_edits')
          )::NUMERIC
          /
          COUNT(*) FILTER (
            WHERE terminal_state IN ('human_approved_as_is', 'human_approved_with_edits', 'human_rejected')
          )::NUMERIC
          * 100,
          1
        )
    END AS human_approval_rate
  FROM flat
  GROUP BY issue_type, severity
  ORDER BY times_flagged DESC;
$$;

COMMENT ON FUNCTION public.auto_reply_issue_patterns(TIMESTAMPTZ) IS
  'Per-(issue_type, severity) breakdown of audit-flagged issues with human approval rates. Drives the analytics dashboard for prompt tuning.';

-- =====================================================================
-- Verification
-- =====================================================================
--   SELECT * FROM auto_reply_overall_stats();
--   SELECT * FROM auto_reply_overall_stats(NOW() - INTERVAL '7 days');
--   SELECT * FROM auto_reply_issue_patterns() LIMIT 20;
