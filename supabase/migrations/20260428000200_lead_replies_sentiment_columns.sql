-- Safety net: ensure lead_replies has the sentiment columns the auto-reply
-- eligibility check + audit pipeline depend on. These are written today by
-- universal-bison-webhook (handleLeadReplied / handleLeadInterested), but
-- the original CREATE TABLE migration didn't include them — they may have
-- been added via Supabase Studio. Idempotent: no-ops if already present.

ALTER TABLE public.lead_replies
  ADD COLUMN IF NOT EXISTS confidence_score INT,
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_source TEXT,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;

-- Allowed values for sentiment_source. Webhook writes 'ai', 'bison', 'hybrid';
-- 'manual' is reserved for admin overrides via the dashboard.
ALTER TABLE public.lead_replies
  DROP CONSTRAINT IF EXISTS lead_replies_sentiment_source_chk;
ALTER TABLE public.lead_replies
  ADD CONSTRAINT lead_replies_sentiment_source_chk
  CHECK (sentiment_source IS NULL OR sentiment_source IN ('ai', 'bison', 'hybrid', 'manual'));

-- Bound confidence_score sensibly. Webhook produces 0–100.
ALTER TABLE public.lead_replies
  DROP CONSTRAINT IF EXISTS lead_replies_confidence_score_chk;
ALTER TABLE public.lead_replies
  ADD CONSTRAINT lead_replies_confidence_score_chk
  CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100);

-- ─────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'lead_replies'
--      AND column_name IN ('confidence_score','ai_reasoning','sentiment_source','needs_review')
--    ORDER BY column_name;
