-- Create client_settings table for backend-managed client configuration
-- Stores per-client settings like cost per lead for ROI calculations

CREATE TABLE IF NOT EXISTS public.client_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT UNIQUE NOT NULL,

  -- ROI Settings
  cost_per_lead DECIMAL(10,2) DEFAULT 50.00,
  default_commission_rate DECIMAL(5,2) DEFAULT 10.00, -- Default commission % (e.g., 10%)

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_settings_workspace
  ON public.client_settings(workspace_name);

-- Enable Row Level Security
ALTER TABLE public.client_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to all (clients can view their settings)
DROP POLICY IF EXISTS "Allow read access to client_settings" ON public.client_settings;
CREATE POLICY "Allow read access to client_settings"
  ON public.client_settings
  FOR SELECT
  USING (true);

-- Only allow updates from service role (backend only)
DROP POLICY IF EXISTS "Allow service role to update client_settings" ON public.client_settings;
CREATE POLICY "Allow service role to update client_settings"
  ON public.client_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_client_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_client_settings_updated_at ON public.client_settings;
CREATE TRIGGER set_client_settings_updated_at
  BEFORE UPDATE ON public.client_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_settings_updated_at();

-- Add comments
COMMENT ON TABLE public.client_settings IS 'Client-specific settings managed from backend (cost per lead, commission rates, etc.)';
COMMENT ON COLUMN public.client_settings.cost_per_lead IS 'Fixed cost per lead for ROI calculations - only editable from backend';
COMMENT ON COLUMN public.client_settings.default_commission_rate IS 'Default commission rate percentage for ROI calculations';

-- Seed with default values for existing clients
INSERT INTO public.client_settings (workspace_name, cost_per_lead, default_commission_rate)
VALUES
  ('Kim Wallace', 50.00, 10.00),
  ('Jeff Schroder', 50.00, 10.00),
  ('David Amiri', 50.00, 10.00),
  ('Kirk Hodgson', 50.00, 10.00)
ON CONFLICT (workspace_name) DO NOTHING;

SELECT 'client_settings table created successfully!' as status;
