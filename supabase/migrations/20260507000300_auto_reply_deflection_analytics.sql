-- Deflection-outcome analytics for the scheduling-intent feature.
--
-- Mirrors the shape of auto_reply_overall_stats / auto_reply_issue_patterns
-- so AutoReplyAnalyticsPage can consume it the same way.
--
-- Returns one row per (workspace_name, deflection_intent) with:
--   - times_deflected         : how often we rendered a deflection draft
--   - auto_sent               : audit cleared the deflection, draft went out
--   - review_required         : audit flagged the deflection, human reviewing
--   - human_approved          : human approved a flagged deflection (with or without edits)
--   - human_rejected          : human rejected a flagged deflection
--   - audit_rejected          : audit hard-rejected the deflection
--   - human_approval_rate     : approved / (approved + rejected) for human-touched rows
--
-- A NULL p_workspace returns all workspaces; passing a name filters to one.

CREATE OR REPLACE FUNCTION public.auto_reply_deflection_outcomes(
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_workspace TEXT DEFAULT NULL
) RETURNS TABLE (
  workspace_name TEXT,
  deflection_intent TEXT,
  times_deflected BIGINT,
  auto_sent BIGINT,
  review_required BIGINT,
  human_approved BIGINT,
  human_rejected BIGINT,
  audit_rejected BIGINT,
  human_approval_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH classified AS (
    SELECT
      arq.workspace_name,
      arq.deflection_intent,
      public._auto_reply_terminal_state(arq.status, arq.audit_issues, arq.error_message) AS terminal_state
    FROM public.auto_reply_queue arq
    WHERE arq.deflection_intent IS NOT NULL
      AND (p_since IS NULL OR arq.updated_at >= p_since)
      AND (p_workspace IS NULL OR arq.workspace_name = p_workspace)
  )
  SELECT
    workspace_name,
    deflection_intent,
    COUNT(*)::BIGINT AS times_deflected,
    COUNT(*) FILTER (WHERE terminal_state = 'audit_auto_sent')::BIGINT AS auto_sent,
    COUNT(*) FILTER (WHERE terminal_state = 'pending_review')::BIGINT AS review_required,
    COUNT(*) FILTER (
      WHERE terminal_state IN ('human_approved_as_is', 'human_approved_with_edits')
    )::BIGINT AS human_approved,
    COUNT(*) FILTER (WHERE terminal_state = 'human_rejected')::BIGINT AS human_rejected,
    COUNT(*) FILTER (WHERE terminal_state = 'audit_rejected')::BIGINT AS audit_rejected,
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
  FROM classified
  GROUP BY workspace_name, deflection_intent
  ORDER BY workspace_name, times_deflected DESC;
$$;

COMMENT ON FUNCTION public.auto_reply_deflection_outcomes(TIMESTAMPTZ, TEXT) IS
  'Per-(workspace, intent) deflection counters with human approval rates. Drives the deflection analytics card.';

-- ─────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────
--   SELECT * FROM auto_reply_deflection_outcomes();
--   SELECT * FROM auto_reply_deflection_outcomes(NOW() - INTERVAL '7 days');
--   SELECT * FROM auto_reply_deflection_outcomes(NULL, 'Jeff Schroder');
