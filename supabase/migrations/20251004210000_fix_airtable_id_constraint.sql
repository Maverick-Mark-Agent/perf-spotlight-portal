-- Fix airtable_id constraint for Email Bison leads
-- Email Bison leads don't have Airtable IDs, so make it optional

-- Step 1: Make airtable_id nullable
ALTER TABLE public.client_leads
ALTER COLUMN airtable_id DROP NOT NULL;

-- Step 2: Drop the unique constraint on airtable_id (if it exists)
-- We'll create a better unique constraint below
ALTER TABLE public.client_leads
DROP CONSTRAINT IF EXISTS client_leads_airtable_id_key;

-- Step 3: Create a proper unique constraint for Email Bison leads
-- Use lead_email + workspace_name as the unique identifier
ALTER TABLE public.client_leads
ADD CONSTRAINT unique_lead_per_workspace
UNIQUE (lead_email, workspace_name);

-- Step 4: Keep airtable_id unique when it exists (for Airtable-sourced leads)
CREATE UNIQUE INDEX idx_client_leads_airtable_unique
  ON public.client_leads(airtable_id)
  WHERE airtable_id IS NOT NULL;

-- Update comments
COMMENT ON COLUMN public.client_leads.airtable_id IS 'Airtable record ID (optional - only for Airtable-sourced leads). Email Bison leads use bison_lead_id instead.';
COMMENT ON CONSTRAINT unique_lead_per_workspace ON public.client_leads IS 'Ensures one lead record per email address per workspace';

-- Verify
SELECT 'airtable_id constraint fixed successfully!' as status;
