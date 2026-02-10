-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================
-- Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
-- Copy and paste this entire file, then click "Run"
-- =====================================================

-- Drop table if exists (for clean slate)
DROP TABLE IF EXISTS public.client_registry CASCADE;

-- Create client_registry table
CREATE TABLE public.client_registry (
  -- Primary identifiers (from Email Bison)
  workspace_id INTEGER PRIMARY KEY,
  workspace_name TEXT NOT NULL UNIQUE,

  -- Display and organization
  display_name TEXT, -- Optional pretty name (from Airtable "Client Company Name")
  is_active BOOLEAN DEFAULT true,

  -- Billing configuration
  billing_type TEXT NOT NULL CHECK (billing_type IN ('per_lead', 'retainer')),
  price_per_lead DECIMAL(10,2) DEFAULT 0.00,
  retainer_amount DECIMAL(10,2) DEFAULT 0.00,

  -- Performance targets
  monthly_kpi_target INTEGER DEFAULT 0,

  -- Integration references
  airtable_record_id TEXT, -- For syncing with Airtable

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_client_registry_workspace_name ON public.client_registry(workspace_name);
CREATE INDEX idx_client_registry_active ON public.client_registry(is_active) WHERE is_active = true;
CREATE INDEX idx_client_registry_billing_type ON public.client_registry(billing_type);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_client_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER client_registry_updated_at
  BEFORE UPDATE ON public.client_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_client_registry_updated_at();

-- RLS Policies (allow public read, service role write)
ALTER TABLE public.client_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to client_registry"
  ON public.client_registry
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to client_registry"
  ON public.client_registry
  FOR ALL
  USING (auth.role() = 'service_role');

-- Verify table created
SELECT 'client_registry table created successfully!' as message;
SELECT COUNT(*) as row_count FROM public.client_registry;
