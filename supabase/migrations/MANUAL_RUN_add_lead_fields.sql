-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================
-- Adds Email Bison lead fields to client_leads table
-- Run at: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

-- Add title and company fields
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS company TEXT;

-- Add JSON fields for dynamic data
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS custom_variables JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add lead status from Email Bison
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS lead_status TEXT;

-- Add campaign data for tracking
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS lead_campaign_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS overall_stats JSONB;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_client_leads_company
  ON public.client_leads(company)
  WHERE company IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_leads_title
  ON public.client_leads(title)
  WHERE title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_leads_status
  ON public.client_leads(lead_status);

-- Create GIN indexes for JSON fields (faster JSONB queries)
CREATE INDEX IF NOT EXISTS idx_client_leads_custom_vars
  ON public.client_leads USING GIN (custom_variables);

CREATE INDEX IF NOT EXISTS idx_client_leads_tags
  ON public.client_leads USING GIN (tags);

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'client_leads'
  AND column_name IN ('title', 'company', 'custom_variables', 'tags', 'lead_status', 'lead_campaign_data', 'overall_stats')
ORDER BY column_name;
