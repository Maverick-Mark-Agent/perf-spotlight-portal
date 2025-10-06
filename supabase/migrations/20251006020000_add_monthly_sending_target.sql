-- Add monthly_sending_target to client_registry
-- This allows Volume Dashboard to work without Airtable

ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS monthly_sending_target INTEGER DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_client_registry_sending_target
  ON public.client_registry(monthly_sending_target)
  WHERE monthly_sending_target > 0;

-- Add comment
COMMENT ON COLUMN public.client_registry.monthly_sending_target IS 'Monthly email sending volume target (from Airtable, migrating to Supabase)';

-- Update existing records with default if needed
UPDATE public.client_registry
SET monthly_sending_target = 0
WHERE monthly_sending_target IS NULL;
