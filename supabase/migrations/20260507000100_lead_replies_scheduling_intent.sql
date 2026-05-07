-- Scheduling-intent classification on inbound replies.
--
-- Written by universal-bison-webhook's AI sentiment call alongside the
-- existing sentiment / is_interested / confidence fields. Read by
-- process-auto-reply-queue to decide whether to render a deterministic
-- deflection draft instead of calling generate-ai-reply.
--
-- Defaults to 'none' so existing rows + any reply that doesn't get
-- classified flows through the existing LLM path unchanged.

ALTER TABLE public.lead_replies
  ADD COLUMN IF NOT EXISTS scheduling_intent TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS scheduling_phrase TEXT,
  ADD COLUMN IF NOT EXISTS scheduling_intent_confidence INT;

ALTER TABLE public.lead_replies
  DROP CONSTRAINT IF EXISTS lead_replies_scheduling_intent_chk;
ALTER TABLE public.lead_replies
  ADD CONSTRAINT lead_replies_scheduling_intent_chk
  CHECK (scheduling_intent IN (
    'none',
    'specific_time',
    'soft_schedule',
    'vague_availability',
    'calendar_request',
    'confirmation'
  ));

ALTER TABLE public.lead_replies
  DROP CONSTRAINT IF EXISTS lead_replies_scheduling_intent_confidence_chk;
ALTER TABLE public.lead_replies
  ADD CONSTRAINT lead_replies_scheduling_intent_confidence_chk
  CHECK (scheduling_intent_confidence IS NULL
         OR scheduling_intent_confidence BETWEEN 0 AND 100);

-- Tag deflection drafts on the queue so analytics can split deflections
-- vs. LLM-generated drafts. NULL = LLM path (existing behavior).
ALTER TABLE public.auto_reply_queue
  ADD COLUMN IF NOT EXISTS deflection_intent TEXT;

ALTER TABLE public.auto_reply_queue
  DROP CONSTRAINT IF EXISTS auto_reply_queue_deflection_intent_chk;
ALTER TABLE public.auto_reply_queue
  ADD CONSTRAINT auto_reply_queue_deflection_intent_chk
  CHECK (deflection_intent IS NULL OR deflection_intent IN (
    'specific_time',
    'soft_schedule',
    'vague_availability',
    'calendar_request',
    'confirmation'
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'lead_replies'
--      AND column_name LIKE 'scheduling%'
--    ORDER BY column_name;
--   -- Expect three rows: scheduling_intent (text, NOT NULL, default 'none'),
--   -- scheduling_intent_confidence (integer, nullable),
--   -- scheduling_phrase (text, nullable).
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'auto_reply_queue' AND column_name = 'deflection_intent';
--   -- Expect one row.
