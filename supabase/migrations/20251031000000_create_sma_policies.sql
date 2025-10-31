-- Create sma_policies table for SMA Insurance commission tracking
-- Stores multiple policies per lead with commission data

CREATE TABLE IF NOT EXISTS public.sma_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Foreign key to client_leads
  lead_id UUID NOT NULL REFERENCES public.client_leads(id) ON DELETE CASCADE,

  -- Workspace constraint (must be SMA Insurance)
  workspace_name TEXT NOT NULL DEFAULT 'SMA Insurance',

  -- Policy details
  policy_type TEXT NOT NULL,
  premium_amount DECIMAL(10,2) NOT NULL CHECK (premium_amount > 0),

  -- Commission tracking
  agency_commission DECIMAL(10,2) NOT NULL CHECK (agency_commission >= 0),
  maverick_commission DECIMAL(10,2) NOT NULL CHECK (maverick_commission >= 0),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Constraint: workspace_name must be 'SMA Insurance'
  CONSTRAINT sma_workspace_check CHECK (workspace_name = 'SMA Insurance')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sma_policies_lead_id
  ON public.sma_policies(lead_id);

CREATE INDEX IF NOT EXISTS idx_sma_policies_workspace
  ON public.sma_policies(workspace_name);

CREATE INDEX IF NOT EXISTS idx_sma_policies_created
  ON public.sma_policies(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.sma_policies ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (will restrict with user auth later)
DROP POLICY IF EXISTS "Allow all operations on sma_policies" ON public.sma_policies;
CREATE POLICY "Allow all operations on sma_policies"
  ON public.sma_policies
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_sma_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_sma_policies_updated_at ON public.sma_policies;
CREATE TRIGGER set_sma_policies_updated_at
  BEFORE UPDATE ON public.sma_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sma_policies_updated_at();

-- Create function to auto-calculate maverick_commission (20% of agency_commission)
CREATE OR REPLACE FUNCTION public.calculate_maverick_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate Maverick commission as 20% of Agency commission
  NEW.maverick_commission = ROUND(NEW.agency_commission * 0.20, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate maverick_commission on insert/update
DROP TRIGGER IF EXISTS auto_calculate_maverick_commission ON public.sma_policies;
CREATE TRIGGER auto_calculate_maverick_commission
  BEFORE INSERT OR UPDATE ON public.sma_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_maverick_commission();

-- Add comments for documentation
COMMENT ON TABLE public.sma_policies IS 'SMA Insurance policies with commission tracking - supports multiple policies per lead';
COMMENT ON COLUMN public.sma_policies.lead_id IS 'References client_leads table';
COMMENT ON COLUMN public.sma_policies.policy_type IS 'Type of insurance policy (Auto, Home, Life, Commercial, etc.)';
COMMENT ON COLUMN public.sma_policies.premium_amount IS 'Annual premium amount for this policy';
COMMENT ON COLUMN public.sma_policies.agency_commission IS 'Commission amount paid to SMA Insurance';
COMMENT ON COLUMN public.sma_policies.maverick_commission IS 'Commission to Maverick (auto-calculated as 20% of agency_commission)';

-- Verify table creation
SELECT 'sma_policies table created successfully!' as status;
