-- Add columns for contact pipeline tracking to zip_batch_pulls table
ALTER TABLE zip_batch_pulls 
ADD COLUMN IF NOT EXISTS qualified_contacts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deliverable_contacts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS uploaded_to_bison BOOLEAN DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_zip_batch_pulls_month_workspace 
ON zip_batch_pulls(month, workspace_name);
