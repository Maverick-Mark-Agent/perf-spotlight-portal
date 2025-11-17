-- Migration: Add producer assignment fields to client_leads
-- This adds columns for tracking which producer/agent is assigned to each lead

-- Add producer assignment columns (nullable for backward compatibility)
ALTER TABLE public.client_leads
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes for efficient producer-based queries
CREATE INDEX IF NOT EXISTS idx_client_leads_assigned_to
  ON public.client_leads(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_client_leads_workspace_assigned
  ON public.client_leads(workspace_name, assigned_to_user_id);

-- Add comment for documentation
COMMENT ON COLUMN public.client_leads.assigned_to_user_id IS 'UUID of the producer/agent assigned to this lead';
COMMENT ON COLUMN public.client_leads.assigned_to_name IS 'Denormalized name of assigned producer for display';
COMMENT ON COLUMN public.client_leads.assigned_at IS 'Timestamp when the lead was assigned';
COMMENT ON COLUMN public.client_leads.assigned_by_user_id IS 'UUID of user who made the assignment';
