-- Migration: Add soft-delete tracking for client_leads
-- Allows leads to be marked as deleted but recoverable

-- Add soft-delete columns
ALTER TABLE public.client_leads
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create index for efficient filtering of non-deleted leads
CREATE INDEX IF NOT EXISTS idx_client_leads_not_deleted
  ON public.client_leads(workspace_name, deleted_at)
  WHERE deleted_at IS NULL;

-- Create index for finding deleted leads
CREATE INDEX IF NOT EXISTS idx_client_leads_deleted
  ON public.client_leads(workspace_name, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.client_leads.deleted_at IS 'Timestamp when lead was soft-deleted (NULL = active)';
COMMENT ON COLUMN public.client_leads.deleted_by_user_id IS 'UUID of user who deleted the lead';
COMMENT ON COLUMN public.client_leads.deletion_reason IS 'Optional reason for deletion';
