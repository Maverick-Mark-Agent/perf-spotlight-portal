/**
 * Apply template update policy migration
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyPolicy() {
  console.log('🔐 Applying template update policy...\n');

  const sql = `
-- Add UPDATE policy for authenticated users
CREATE POLICY IF NOT EXISTS "Allow authenticated users to update reply templates"
  ON reply_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
`;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error applying policy:', error);
      return;
    }

    console.log('✅ Policy applied successfully!');
    console.log('   Authenticated users can now update reply templates\n');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyPolicy();
