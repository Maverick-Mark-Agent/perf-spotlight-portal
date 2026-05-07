-- Per-workspace scheduling-intent deflection configuration.
--
-- All Maverick clients run home-insurance-renewal campaigns, so the default
-- deflection templates ship hardcoded in supabase/functions/_shared/schedulingIntent.ts.
-- Per-workspace overrides land in auto_reply_deflection_templates (any subset
-- of the five buckets; missing keys fall through to defaults).
--
-- Defaults to OFF for every workspace — Phase 3 enables the two Jeff Schroder
-- workspaces by flipping auto_reply_deflect_scheduling to TRUE after the
-- 5-day shadow window.

ALTER TABLE public.client_registry
  ADD COLUMN IF NOT EXISTS auto_reply_deflect_scheduling BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_reply_deflection_templates JSONB,
  ADD COLUMN IF NOT EXISTS auto_reply_min_scheduling_confidence INT NOT NULL DEFAULT 70;

ALTER TABLE public.client_registry
  DROP CONSTRAINT IF EXISTS client_registry_min_scheduling_confidence_chk;
ALTER TABLE public.client_registry
  ADD CONSTRAINT client_registry_min_scheduling_confidence_chk
  CHECK (auto_reply_min_scheduling_confidence BETWEEN 0 AND 100);

-- ─────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────
--   SELECT workspace_name,
--          auto_reply_deflect_scheduling,
--          auto_reply_min_scheduling_confidence,
--          auto_reply_deflection_templates
--     FROM client_registry
--    ORDER BY workspace_name;
--   -- Every row should show auto_reply_deflect_scheduling=false,
--   -- auto_reply_min_scheduling_confidence=70, templates=NULL.
