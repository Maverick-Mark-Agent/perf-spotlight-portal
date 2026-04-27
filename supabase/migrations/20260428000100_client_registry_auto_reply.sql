-- Per-workspace auto-reply configuration on client_registry.
--
-- Every column defaults to a safe value (auto_reply_enabled=FALSE, strict
-- thresholds) so the dark deploy ships without affecting any workspace.
-- Phase 3 enables LeBlanc Agency by flipping auto_reply_enabled to TRUE.

ALTER TABLE public.client_registry
  ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- IANA timezone (e.g. 'America/Chicago'). NULL means we haven't synced from
  -- Bison yet — eligibility check will skip enqueue with skip_reason='no_timezone'.
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  -- Strict defaults for pilot. Per-workspace tunable from Settings UI.
  ADD COLUMN IF NOT EXISTS auto_reply_min_sentiment_confidence INT NOT NULL DEFAULT 85,
  ADD COLUMN IF NOT EXISTS auto_reply_min_audit_score INT NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS auto_reply_max_per_hour INT NOT NULL DEFAULT 30,
  -- "Human delay" floor. Replies never go out instantly even when in-window.
  ADD COLUMN IF NOT EXISTS auto_reply_min_delay_minutes INT NOT NULL DEFAULT 10;

-- Sanity bounds on the threshold columns. Caps prevent admins from
-- accidentally setting a 0% bar (would auto-send everything) or > 100.
ALTER TABLE public.client_registry
  DROP CONSTRAINT IF EXISTS client_registry_auto_reply_thresholds_chk;
ALTER TABLE public.client_registry
  ADD CONSTRAINT client_registry_auto_reply_thresholds_chk
  CHECK (
    auto_reply_min_sentiment_confidence BETWEEN 0 AND 100
    AND auto_reply_min_audit_score BETWEEN 0 AND 100
    AND auto_reply_max_per_hour BETWEEN 0 AND 1000
    AND auto_reply_min_delay_minutes BETWEEN 0 AND 1440
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────
--   SELECT workspace_name, auto_reply_enabled, timezone,
--          auto_reply_min_sentiment_confidence, auto_reply_min_audit_score,
--          auto_reply_max_per_hour, auto_reply_min_delay_minutes
--     FROM client_registry
--    ORDER BY workspace_name;
--   -- Every row should show auto_reply_enabled=false, timezone=NULL,
--   -- and the four numeric defaults (85, 90, 30, 10).
