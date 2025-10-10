-- =====================================================
-- EMAIL BISON INSTANCE FIELD
-- =====================================================
-- Add field to track which Email Bison instance a workspace belongs to
-- (Maverick vs Long Run) since workspace IDs are not unique across instances
-- =====================================================

-- Add bison_instance column
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS bison_instance TEXT CHECK (bison_instance IN ('Maverick', 'Long Run'));

-- Set default for existing records (assume Maverick for now)
UPDATE public.client_registry
SET bison_instance = 'Maverick'
WHERE bison_instance IS NULL AND bison_workspace_id IS NOT NULL;

-- Create composite index for unique lookups
CREATE INDEX IF NOT EXISTS idx_client_registry_bison_instance_id
ON public.client_registry(bison_instance, bison_workspace_id);

-- Comments
COMMENT ON COLUMN public.client_registry.bison_instance IS 'Email Bison instance: Maverick or Long Run (workspace IDs are not unique across instances)';
