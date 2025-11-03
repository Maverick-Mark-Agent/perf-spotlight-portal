-- ========================================
-- SMA POLICIES TABLE MIGRATION
-- Copy this entire file and run it in Supabase SQL Editor
-- ========================================

-- Create sma_policies table for SMA Insurance commission tracking
CREATE TABLE IF NOT EXISTS public.sma_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.client_leads(id) ON DELETE CASCADE,
  workspace_name TEXT NOT NULL DEFAULT 'SMA Insurance',
  policy_type TEXT NOT NULL,
  premium_amount DECIMAL(10,2) NOT NULL CHECK (premium_amount > 0),
  agency_commission DECIMAL(10,2) NOT NULL CHECK (agency_commission >= 0),
  maverick_commission DECIMAL(10,2) NOT NULL CHECK (maverick_commission >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT sma_workspace_check CHECK (workspace_name = 'SMA Insurance')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sma_policies_lead_id ON public.sma_policies(lead_id);
CREATE INDEX IF NOT EXISTS idx_sma_policies_workspace ON public.sma_policies(workspace_name);
CREATE INDEX IF NOT EXISTS idx_sma_policies_created ON public.sma_policies(created_at DESC);

-- Enable RLS
ALTER TABLE public.sma_policies ENABLE ROW LEVEL SECURITY;

-- Policy
DROP POLICY IF EXISTS "Allow all operations on sma_policies" ON public.sma_policies;
CREATE POLICY "Allow all operations on sma_policies"
  ON public.sma_policies FOR ALL USING (true) WITH CHECK (true);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION public.handle_sma_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sma_policies_updated_at ON public.sma_policies;
CREATE TRIGGER set_sma_policies_updated_at
  BEFORE UPDATE ON public.sma_policies
  FOR EACH ROW EXECUTE FUNCTION public.handle_sma_policies_updated_at();

-- Auto-calculate commission trigger
CREATE OR REPLACE FUNCTION public.calculate_maverick_commission()
RETURNS TRIGGER AS $$
BEGIN
  NEW.maverick_commission = ROUND(NEW.agency_commission * 0.20, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_calculate_maverick_commission ON public.sma_policies;
CREATE TRIGGER auto_calculate_maverick_commission
  BEFORE INSERT OR UPDATE ON public.sma_policies
  FOR EACH ROW EXECUTE FUNCTION public.calculate_maverick_commission();

-- Verify
SELECT 'sma_policies table created successfully!' as status;
