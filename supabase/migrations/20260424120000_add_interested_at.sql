-- Add immutable interested_at column to client_leads.
--
-- Why: date_received is the latest-reply timestamp and gets overwritten on every
-- upsert. Leads first classified as interested in a prior month have their
-- date_received bumped forward when a new reply arrives, which pulls them into
-- the current month's KPI counts. interested_at captures the first moment a
-- lead flipped to interested=true and is never overwritten afterwards.

ALTER TABLE public.client_leads
  ADD COLUMN IF NOT EXISTS interested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_leads.interested_at IS
  'Immutable timestamp of first time interested flipped to true. Never overwrite on upsert.';

-- Backfill historical rows. created_at is the row''s first-seen time and is
-- never overwritten; date_received is the latest reply. LEAST() picks the
-- earlier of the two, which is the best proxy we have for "first interested"
-- on rows that existed before this column.
UPDATE public.client_leads
SET interested_at = LEAST(created_at, COALESCE(date_received, created_at))
WHERE interested = true
  AND interested_at IS NULL;

-- Partial index on the filter we'll use for KPI bucketing.
CREATE INDEX IF NOT EXISTS idx_client_leads_interested_at
  ON public.client_leads (interested_at DESC)
  WHERE interested = true;

-- Verification (run after apply):
--   SELECT
--     COUNT(*) FILTER (WHERE interested = true) AS interested_rows,
--     COUNT(*) FILTER (WHERE interested = true AND interested_at IS NOT NULL) AS with_stamp
--   FROM client_leads WHERE deleted_at IS NULL;
--
--   -- Schrauf Agency: should drop from 50 to ~37 on interested_at bucket
--   SELECT COUNT(*) FROM client_leads
--   WHERE workspace_name = 'Schrauf Agency'
--     AND interested = true AND deleted_at IS NULL
--     AND interested_at >= '2026-04-01' AND interested_at < '2026-05-01';
