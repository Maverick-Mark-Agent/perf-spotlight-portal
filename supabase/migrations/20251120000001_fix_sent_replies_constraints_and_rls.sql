-- Fix sent_replies table issues
-- 1. Add unique constraint on reply_uuid (required for upsert)
-- 2. Add RLS policies to allow inserts

-- Step 1: Add unique constraint on reply_uuid
ALTER TABLE sent_replies
ADD CONSTRAINT sent_replies_reply_uuid_key UNIQUE (reply_uuid);

-- Step 2: Enable RLS (if not already enabled)
ALTER TABLE sent_replies ENABLE ROW LEVEL SECURITY;

-- Step 3: Add RLS policy to allow INSERT for authenticated users
CREATE POLICY "Allow authenticated users to insert sent_replies"
ON sent_replies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 4: Add RLS policy to allow SELECT for authenticated users
CREATE POLICY "Allow authenticated users to select sent_replies"
ON sent_replies
FOR SELECT
TO authenticated
USING (true);

-- Step 5: Add RLS policy to allow UPDATE for authenticated users
CREATE POLICY "Allow authenticated users to update sent_replies"
ON sent_replies
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 6: Add RLS policy to allow anonymous users to SELECT (for UI to work)
CREATE POLICY "Allow anon users to select sent_replies"
ON sent_replies
FOR SELECT
TO anon
USING (true);
