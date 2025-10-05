-- =====================================================
-- CLIENT REGISTRY: Single Source of Truth for All Clients
-- =====================================================
-- This table serves as the master client registry, combining data from:
-- - Email Bison (workspace_id, workspace_name)
-- - Airtable (display_name, monthly_kpi_target)
-- - Pricing data (billing_type, price_per_lead, retainer_amount)
--
-- Email Bison workspace names are the authoritative source.
-- All dashboards and Edge Functions must query this table.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.client_registry (
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

-- RLS Policies (allow public read, admin write)
ALTER TABLE public.client_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to client_registry"
  ON public.client_registry
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to client_registry"
  ON public.client_registry
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE public.client_registry IS 'Master client registry - single source of truth for all client data. Email Bison workspace names are authoritative.';
COMMENT ON COLUMN public.client_registry.workspace_id IS 'Email Bison workspace ID (primary key)';
COMMENT ON COLUMN public.client_registry.workspace_name IS 'Email Bison workspace name (SOURCE OF TRUTH for all dashboards)';
COMMENT ON COLUMN public.client_registry.display_name IS 'Optional display name from Airtable Client Company Name field';
COMMENT ON COLUMN public.client_registry.billing_type IS 'per_lead or retainer';
COMMENT ON COLUMN public.client_registry.price_per_lead IS 'Price per lead for per_lead clients (0 for retainer clients)';
COMMENT ON COLUMN public.client_registry.retainer_amount IS 'Monthly retainer amount for retainer clients (0 for per_lead clients)';
COMMENT ON COLUMN public.client_registry.monthly_kpi_target IS 'Monthly lead generation target from Airtable';
