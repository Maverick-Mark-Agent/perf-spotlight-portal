-- Add bison_api_key column to client_registry table
ALTER TABLE client_registry
ADD COLUMN IF NOT EXISTS bison_api_key TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN client_registry.bison_api_key IS 'Workspace-specific Email Bison API key for accessing lead details';
