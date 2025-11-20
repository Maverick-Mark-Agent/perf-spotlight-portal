-- Allow the same Email Bison account to appear in multiple workspaces
-- This fixes the issue where workspace-specific API keys return shared accounts
-- and only the last workspace to sync "owns" the account

-- Drop the current constraint
ALTER TABLE public.email_accounts_raw
  DROP CONSTRAINT IF EXISTS unique_bison_account;

-- Add new constraint that includes workspace_id
-- This allows the same bison_account_id to exist in multiple workspaces
ALTER TABLE public.email_accounts_raw
  ADD CONSTRAINT unique_bison_account_per_workspace
  UNIQUE (bison_account_id, bison_instance, workspace_id);

-- Update the edge function upsert conflict target
COMMENT ON CONSTRAINT unique_bison_account_per_workspace ON public.email_accounts_raw IS
  'Ensures each Bison account can only appear once per workspace. Same account can exist in multiple workspaces if their workspace-specific API keys return it.';
