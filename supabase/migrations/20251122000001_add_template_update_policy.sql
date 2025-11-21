-- Migration: Add RLS policies for authenticated users to manage reply templates
-- Purpose: Enable template management UI for creating and editing client templates
-- Date: 2025-11-22

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Allow authenticated users to insert reply templates" ON reply_templates;
DROP POLICY IF EXISTS "Allow authenticated users to update reply templates" ON reply_templates;

-- Add INSERT policy for authenticated users (for creating new templates)
CREATE POLICY "Allow authenticated users to insert reply templates"
  ON reply_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add UPDATE policy for authenticated users (for editing existing templates)
CREATE POLICY "Allow authenticated users to update reply templates"
  ON reply_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON POLICY "Allow authenticated users to insert reply templates" ON reply_templates
  IS 'Allows logged-in users to create new reply templates through the Client Profile UI';

COMMENT ON POLICY "Allow authenticated users to update reply templates" ON reply_templates
  IS 'Allows logged-in users to edit existing reply templates through the Client Profile UI';
