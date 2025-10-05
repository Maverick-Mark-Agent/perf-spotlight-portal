-- Create client_leads table for Client Portal
-- Stores leads from Airtable Positive Replies with pipeline management

CREATE TABLE IF NOT EXISTS public.client_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airtable_id TEXT UNIQUE NOT NULL,

  -- Client Info
  workspace_name TEXT NOT NULL,
  client_name TEXT,

  -- Lead Contact Info
  lead_email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,

  -- Lead Details
  date_received TIMESTAMP WITH TIME ZONE,
  reply_received TEXT,
  email_sent TEXT,
  email_subject TEXT,
  lead_value DECIMAL(10,2) DEFAULT 500,

  -- Home Insurance Specific (Kim Wallace)
  renewal_date TEXT,
  birthday TEXT,

  -- Campaign Info
  campaign_name TEXT,
  sender_email TEXT,
  icp BOOLEAN DEFAULT false,

  -- Pipeline Management
  pipeline_stage TEXT DEFAULT 'new',
  pipeline_position INTEGER DEFAULT 0,
  notes TEXT, -- Maps to "MJ Notes" from Airtable

  -- Email Bison Link
  bison_conversation_url TEXT,
  bison_lead_id TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_leads_workspace
  ON public.client_leads(workspace_name);

CREATE INDEX IF NOT EXISTS idx_client_leads_pipeline
  ON public.client_leads(pipeline_stage);

CREATE INDEX IF NOT EXISTS idx_client_leads_date
  ON public.client_leads(date_received DESC);

CREATE INDEX IF NOT EXISTS idx_client_leads_airtable
  ON public.client_leads(airtable_id);

CREATE INDEX IF NOT EXISTS idx_client_leads_updated
  ON public.client_leads(updated_at DESC);

-- Enable Row Level Security (for future client logins)
ALTER TABLE public.client_leads ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (will restrict with client auth later)
DROP POLICY IF EXISTS "Allow all operations on client_leads" ON public.client_leads;
CREATE POLICY "Allow all operations on client_leads"
  ON public.client_leads
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_client_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_client_leads_updated_at ON public.client_leads;
CREATE TRIGGER set_client_leads_updated_at
  BEFORE UPDATE ON public.client_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_leads_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.client_leads IS 'Client portal leads from Airtable Positive Replies with pipeline management';
COMMENT ON COLUMN public.client_leads.pipeline_stage IS 'Pipeline stage: new, follow-up, quoting, won, lost, nurture';
COMMENT ON COLUMN public.client_leads.pipeline_position IS 'Order within pipeline stage for drag-and-drop sorting';
COMMENT ON COLUMN public.client_leads.last_synced_at IS 'Last time this record was synced from Airtable';

-- Verify table creation
SELECT 'client_leads table created successfully!' as status;
