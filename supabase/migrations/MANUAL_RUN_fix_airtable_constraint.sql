-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================
-- URL: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
--
-- This fixes the airtable_id NOT NULL constraint that prevents
-- Email Bison leads from being inserted into the database

-- Step 1: Make airtable_id nullable
ALTER TABLE public.client_leads
ALTER COLUMN airtable_id DROP NOT NULL;

-- Step 2: Drop the unique constraint on airtable_id (if it exists)
ALTER TABLE public.client_leads
DROP CONSTRAINT IF EXISTS client_leads_airtable_id_key;

-- Step 3: Create a proper unique constraint for Email Bison leads
-- Use lead_email + workspace_name as the unique identifier
ALTER TABLE public.client_leads
ADD CONSTRAINT unique_lead_per_workspace
UNIQUE (lead_email, workspace_name);

-- Step 4: Keep airtable_id unique when it exists (for Airtable-sourced leads)
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_leads_airtable_unique
  ON public.client_leads(airtable_id)
  WHERE airtable_id IS NOT NULL;

-- Update comments
COMMENT ON COLUMN public.client_leads.airtable_id IS 'Airtable record ID (optional - only for Airtable-sourced leads). Email Bison leads use bison_lead_id instead.';
COMMENT ON CONSTRAINT unique_lead_per_workspace ON public.client_leads IS 'Ensures one lead record per email address per workspace';

-- Verify the changes
SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'client_leads'
  AND column_name = 'airtable_id';

-- Show constraints
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'public.client_leads'::regclass
  AND conname LIKE '%airtable%' OR conname LIKE '%workspace%';

SELECT '✅ airtable_id constraint fixed successfully!' as status;
