-- Add interested flag to client_leads
-- This allows users to mark leads as positive/interested in the portal

ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS interested BOOLEAN DEFAULT false;

-- Add index for filtering interested leads
CREATE INDEX IF NOT EXISTS idx_client_leads_interested
  ON public.client_leads(interested)
  WHERE interested = true;

-- Update comment
COMMENT ON COLUMN public.client_leads.interested IS 'Flag to mark leads as positive/interested (manually set in portal)';

-- Verify
SELECT 'interested column added successfully!' as status;
