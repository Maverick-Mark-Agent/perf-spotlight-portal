-- Migration: Add bison_reply_id and fix conversation URLs
-- Purpose: Store reply IDs to generate working Email Bison conversation links

-- Step 1: Add bison_reply_id column
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS bison_reply_id TEXT;

COMMENT ON COLUMN public.client_leads.bison_reply_id IS 'Email Bison reply ID for the interested reply that brought this lead into the pipeline';

-- Step 2: Create index for reply ID lookups
CREATE INDEX IF NOT EXISTS idx_client_leads_bison_reply_id
  ON public.client_leads(bison_reply_id)
  WHERE bison_reply_id IS NOT NULL;

-- Step 3: Create updated conversation URL generation function using reply ID
CREATE OR REPLACE FUNCTION generate_bison_reply_url(
  p_workspace_id INTEGER,
  p_reply_id TEXT,
  p_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com'
) RETURNS TEXT AS $$
BEGIN
  IF p_workspace_id IS NULL OR p_reply_id IS NULL THEN
    RETURN NULL;
  END IF;
  -- Use reply-based URL pattern
  RETURN p_base_url || '/workspaces/' || p_workspace_id || '/replies/' || p_reply_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_bison_reply_url IS 'Generates Email Bison conversation URL from workspace ID and reply ID';

-- Note: Conversation URLs will be populated when we re-sync with reply IDs
-- The sync script will store bison_reply_id and call this function to generate URLs
