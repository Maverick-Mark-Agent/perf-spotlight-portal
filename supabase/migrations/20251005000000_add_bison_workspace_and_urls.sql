-- Migration: Add bison_workspace_id and generate conversation URLs
-- Purpose: Store workspace IDs and generate Email Bison conversation URLs for leads

-- Step 1: Add bison_workspace_id column to client_leads
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS bison_workspace_id INTEGER;

COMMENT ON COLUMN public.client_leads.bison_workspace_id IS 'Email Bison workspace/team ID for generating conversation URLs';

-- Step 2: Create workspace mappings table for scalability
CREATE TABLE IF NOT EXISTS public.workspace_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_name TEXT UNIQUE NOT NULL,
  bison_workspace_id INTEGER NOT NULL,
  bison_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.workspace_mappings IS 'Maps workspace names to Email Bison workspace IDs for URL generation';

-- Step 3: Insert known workspace mappings
INSERT INTO public.workspace_mappings (workspace_name, bison_workspace_id)
VALUES
  ('Devin Hodo', 37),
  ('David Amiri', 25)
ON CONFLICT (workspace_name) DO NOTHING;

-- Step 4: Create function to generate conversation URLs
CREATE OR REPLACE FUNCTION generate_bison_conversation_url(
  p_workspace_id INTEGER,
  p_lead_id TEXT,
  p_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com'
) RETURNS TEXT AS $$
BEGIN
  IF p_workspace_id IS NULL OR p_lead_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_base_url || '/workspaces/' || p_workspace_id || '/leads/' || p_lead_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_bison_conversation_url IS 'Generates Email Bison conversation URL from workspace ID and lead ID';

-- Step 5: Backfill Devin Hodo leads with workspace ID and conversation URLs
UPDATE public.client_leads
SET
  bison_workspace_id = 37,
  bison_conversation_url = generate_bison_conversation_url(37, bison_lead_id)
WHERE
  workspace_name = 'Devin Hodo'
  AND bison_lead_id IS NOT NULL;

-- Step 6: Backfill David Amiri leads with workspace ID and conversation URLs
UPDATE public.client_leads
SET
  bison_workspace_id = 25,
  bison_conversation_url = generate_bison_conversation_url(25, bison_lead_id)
WHERE
  workspace_name = 'David Amiri'
  AND bison_lead_id IS NOT NULL;

-- Step 7: Create index for faster workspace lookups
CREATE INDEX IF NOT EXISTS idx_client_leads_bison_workspace_id
  ON public.client_leads(bison_workspace_id)
  WHERE bison_workspace_id IS NOT NULL;

-- Verification query
SELECT
  workspace_name,
  COUNT(*) as total_leads,
  COUNT(bison_conversation_url) as leads_with_url,
  COUNT(bison_workspace_id) as leads_with_workspace_id
FROM public.client_leads
WHERE workspace_name IN ('Devin Hodo', 'David Amiri')
GROUP BY workspace_name;
