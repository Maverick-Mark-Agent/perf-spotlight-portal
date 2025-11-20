-- Fix data type mismatch and add foreign key relationship
-- sent_replies.reply_uuid is TEXT but lead_replies.id is UUID

-- Step 1: Convert reply_uuid from TEXT to UUID
ALTER TABLE sent_replies
ALTER COLUMN reply_uuid TYPE uuid USING reply_uuid::uuid;

-- Step 2: Add foreign key constraint
ALTER TABLE sent_replies
ADD CONSTRAINT sent_replies_reply_uuid_fkey
FOREIGN KEY (reply_uuid)
REFERENCES lead_replies(id)
ON DELETE CASCADE;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sent_replies_reply_uuid ON sent_replies(reply_uuid);
