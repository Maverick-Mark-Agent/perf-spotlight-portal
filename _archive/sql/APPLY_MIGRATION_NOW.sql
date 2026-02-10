-- ========================================
-- AI Reply System Migration
-- Add bison_reply_numeric_id Column
-- ========================================
--
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
-- 2. Copy this entire file
-- 3. Paste into SQL Editor
-- 4. Click "Run"
--
-- ========================================

-- Step 1: Add numeric ID column
ALTER TABLE lead_replies
ADD COLUMN IF NOT EXISTS bison_reply_numeric_id BIGINT;

-- Step 2: Backfill existing numeric IDs
UPDATE lead_replies
SET bison_reply_numeric_id = CAST(bison_reply_id AS BIGINT)
WHERE bison_reply_id IS NOT NULL
  AND bison_reply_id ~ '^[0-9]+$'
  AND bison_reply_numeric_id IS NULL;

-- Step 3: Create performance index
CREATE INDEX IF NOT EXISTS idx_lead_replies_numeric_id
ON lead_replies(bison_reply_numeric_id)
WHERE bison_reply_numeric_id IS NOT NULL;

-- Step 4: Add documentation
COMMENT ON COLUMN lead_replies.bison_reply_numeric_id IS 'Numeric reply ID from Email Bison (used for API calls to /api/replies/{id}/reply)';
COMMENT ON COLUMN lead_replies.bison_reply_id IS 'Reply ID from Email Bison - can be UUID or numeric string (used for UI links and reference)';

-- Step 5: Verify migration
SELECT
  'Migration verification:' as status,
  COUNT(*) as total_replies,
  COUNT(bison_reply_numeric_id) as with_numeric_id,
  COUNT(bison_reply_numeric_id)::float / NULLIF(COUNT(*), 0) * 100 as percentage_populated
FROM lead_replies;

-- Step 6: Show sample data
SELECT
  id,
  lead_email,
  bison_reply_id,
  bison_reply_numeric_id,
  created_at
FROM lead_replies
ORDER BY created_at DESC
LIMIT 10;
