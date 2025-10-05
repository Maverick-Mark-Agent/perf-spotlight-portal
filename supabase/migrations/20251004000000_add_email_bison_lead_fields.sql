-- Add complete Email Bison lead fields
-- This enables full lead data storage without Airtable dependency

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

-- Update comments for documentation
COMMENT ON COLUMN public.client_leads.title IS 'Job title from Email Bison lead data';
COMMENT ON COLUMN public.client_leads.company IS 'Company name from Email Bison lead data';
COMMENT ON COLUMN public.client_leads.custom_variables IS 'Custom variables array from Email Bison (e.g., savings amount, personalized lines)';
COMMENT ON COLUMN public.client_leads.tags IS 'Tags array from Email Bison (e.g., Outlook, Proofpoint)';
COMMENT ON COLUMN public.client_leads.lead_status IS 'Lead status from Email Bison (unverified, verified, etc.)';
COMMENT ON COLUMN public.client_leads.lead_campaign_data IS 'Campaign-specific data per lead from Email Bison';
COMMENT ON COLUMN public.client_leads.overall_stats IS 'Overall engagement stats from Email Bison (emails sent, opens, replies)';

-- Verify
SELECT 'Email Bison lead fields added successfully!' as status;
