-- =====================================================
-- EMAIL BISON WORKSPACE MAPPING
-- =====================================================
-- Add explicit Email Bison workspace ID and name fields
-- to fix workspace mapping issues in Volume Dashboard
-- =====================================================

ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS bison_workspace_id INTEGER,
ADD COLUMN IF NOT EXISTS bison_workspace_name TEXT;

-- Create index for faster workspace lookups
CREATE INDEX IF NOT EXISTS idx_client_registry_bison_workspace_id
ON public.client_registry(bison_workspace_id);

-- Comments for documentation
COMMENT ON COLUMN public.client_registry.bison_workspace_id IS 'Email Bison workspace ID for API calls and workspace switching';
COMMENT ON COLUMN public.client_registry.bison_workspace_name IS 'Email Bison workspace name for display and verification (may differ from workspace_name)';
