-- Add numeric ID column for Email Bison API compatibility
-- Email Bison API requires INTEGER reply_id, but we've been storing UUIDs

-- Step 1: Add new column for numeric reply ID
ALTER TABLE lead_replies
ADD COLUMN IF NOT EXISTS bison_reply_numeric_id BIGINT;

-- Step 2: Backfill numeric IDs for existing records that have numeric values
-- (Records with UUIDs will remain NULL until next webhook delivery)
UPDATE lead_replies
SET bison_reply_numeric_id = CAST(bison_reply_id AS BIGINT)
WHERE bison_reply_id IS NOT NULL
  AND bison_reply_id ~ '^[0-9]+$';  -- Only numeric strings

-- Step 3: Add index for performance
CREATE INDEX IF NOT EXISTS idx_lead_replies_numeric_id
ON lead_replies(bison_reply_numeric_id)
WHERE bison_reply_numeric_id IS NOT NULL;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN lead_replies.bison_reply_numeric_id IS 'Numeric reply ID from Email Bison (used for API calls to /api/replies/{id}/reply)';
COMMENT ON COLUMN lead_replies.bison_reply_id IS 'Reply ID from Email Bison - can be UUID or numeric string (used for UI links and reference)';

-- Note: We keep both columns because:
-- - bison_reply_id: Used for conversation URLs (can be UUID or numeric)
-- - bison_reply_numeric_id: Required for Email Bison API calls (must be integer)
