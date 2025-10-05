-- Migration: Add bison_reply_uuid column
-- Purpose: Store reply UUID for proper Email Bison conversation URLs

ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS bison_reply_uuid TEXT;

COMMENT ON COLUMN public.client_leads.bison_reply_uuid IS 'Email Bison reply UUID for generating conversation URLs';

CREATE INDEX IF NOT EXISTS idx_client_leads_bison_reply_uuid
  ON public.client_leads(bison_reply_uuid)
  WHERE bison_reply_uuid IS NOT NULL;

-- Update URL generation function to use UUID
CREATE OR REPLACE FUNCTION generate_bison_conversation_url(
  p_reply_uuid TEXT,
  p_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com'
) RETURNS TEXT AS $$
BEGIN
  IF p_reply_uuid IS NULL THEN
    RETURN NULL;
  END IF;
  -- Use the working Airtable URL pattern: /inbox/replies/{uuid}
  RETURN p_base_url || '/inbox/replies/' || p_reply_uuid;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_bison_conversation_url IS 'Generates Email Bison conversation URL using reply UUID (Airtable pattern)';
