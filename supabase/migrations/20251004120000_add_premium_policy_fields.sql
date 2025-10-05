-- Add premium_amount and policy_type fields to client_leads table
-- These fields are required when moving leads to "Won" stage

ALTER TABLE public.client_leads
  ADD COLUMN IF NOT EXISTS premium_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS policy_type TEXT;

-- Add index for performance on premium queries
CREATE INDEX IF NOT EXISTS idx_client_leads_premium
  ON public.client_leads(premium_amount) WHERE premium_amount IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.client_leads.premium_amount IS 'Total premium amount closed for won deals';
COMMENT ON COLUMN public.client_leads.policy_type IS 'Type of policy closed (e.g., Home Insurance, Auto, Life, etc.)';

-- Verify
SELECT 'Premium and policy type fields added successfully!' as status;
