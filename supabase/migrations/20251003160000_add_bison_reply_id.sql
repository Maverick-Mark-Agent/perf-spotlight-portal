-- Add bison_reply_id as unique key for Email Bison direct sync
-- This allows us to sync directly from Email Bison without Airtable

-- Add new column if it doesn't exist
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS bison_reply_id TEXT;

-- Make airtable_id nullable (no longer required)
ALTER TABLE public.client_leads
ALTER COLUMN airtable_id DROP NOT NULL;

-- Add unique constraint on bison_reply_id
-- Drop existing constraint if it exists
ALTER TABLE public.client_leads DROP CONSTRAINT IF EXISTS client_leads_bison_reply_id_key;

-- Add unique constraint
ALTER TABLE public.client_leads
  ADD CONSTRAINT client_leads_bison_reply_id_key
  UNIQUE (bison_reply_id) DEFERRABLE INITIALLY DEFERRED;

-- Also create index for performance
CREATE INDEX IF NOT EXISTS idx_client_leads_bison_reply
  ON public.client_leads(bison_reply_id)
  WHERE bison_reply_id IS NOT NULL;

-- Update comments
COMMENT ON COLUMN public.client_leads.bison_reply_id IS 'Unique Email Bison reply ID for direct sync';
COMMENT ON COLUMN public.client_leads.airtable_id IS 'Legacy Airtable ID (optional, for migration only)';

-- Verify
SELECT 'bison_reply_id column added successfully!' as status;
