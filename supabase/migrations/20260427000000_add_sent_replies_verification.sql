-- Add verification & retry tracking to sent_replies.
--
-- Purpose: Currently `status='sent'` only proves Bison's HTTP API said 200 — not
-- that Bison actually delivered the email. We add `verified_at` which gets stamped
-- when Bison fires a `manual_email_sent` webhook event back to us, giving two-step
-- delivery confirmation.
--
-- Also adds:
--   - bison_outbound_reply_id / _uuid: the response ID from POST /api/replies/{id}/reply
--     (currently we throw this away; needed to match incoming webhook events)
--   - retry_count / last_retry_at: support auto-retry-once policy
--   - updated_at + trigger: track when status changes
--
-- All columns are nullable / have defaults, so this is safe to apply with live traffic.

ALTER TABLE sent_replies
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bison_outbound_reply_id BIGINT,
  ADD COLUMN IF NOT EXISTS bison_outbound_reply_uuid UUID;

-- Index for fast verification matching: webhook handler looks up sent rows
-- in the workspace+lead_email scope that haven't been verified yet.
CREATE INDEX IF NOT EXISTS idx_sent_replies_pending_verification
  ON sent_replies (workspace_name, lead_email, created_at DESC)
  WHERE status = 'sent' AND verified_at IS NULL;

-- Index for fast lookup by outbound reply id (the precise primary-key match
-- when we have it). NULL-tolerant partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_sent_replies_outbound_reply_id
  ON sent_replies (bison_outbound_reply_id)
  WHERE bison_outbound_reply_id IS NOT NULL;

-- Index for the stuck-sending cleanup cron (Phase 5).
CREATE INDEX IF NOT EXISTS idx_sent_replies_stuck_sending
  ON sent_replies (status, created_at)
  WHERE status = 'sending';

-- updated_at trigger so we can tell when a row's status was last changed
-- (currently only created_at and sent_at are tracked — sent_at gets stamped
-- at insert, not at actual send time).
CREATE OR REPLACE FUNCTION update_sent_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sent_replies_updated_at ON sent_replies;

CREATE TRIGGER set_sent_replies_updated_at
  BEFORE UPDATE ON sent_replies
  FOR EACH ROW EXECUTE FUNCTION update_sent_replies_updated_at();

-- Backfill updated_at on existing rows so it isn't NULL.
UPDATE sent_replies SET updated_at = COALESCE(sent_at, created_at) WHERE updated_at IS NULL;

-- Backfill comment for future operators.
COMMENT ON COLUMN sent_replies.verified_at IS
  'Stamped when Bison fires manual_email_sent webhook confirming actual delivery. NULL means we got the API 200 but have not yet confirmed Bison sent the email.';
COMMENT ON COLUMN sent_replies.bison_outbound_reply_id IS
  'data.reply.id from POST /api/replies/{id}/reply response. Primary key for matching incoming manual_email_sent webhook events.';
COMMENT ON COLUMN sent_replies.bison_outbound_reply_uuid IS
  'data.reply.uuid from POST /api/replies/{id}/reply response. Backup key for matching.';
COMMENT ON COLUMN sent_replies.retry_count IS
  'Number of automatic retries attempted. 0 = original send, 1 = one retry attempted.';
