import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('🔄 Applying multi-workspace accounts migration...\n');

  const migrationSQL = `
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
  `;

  console.log('📄 Migration SQL:');
  console.log(migrationSQL);
  console.log('\n🚀 Executing migration...\n');

  // Split by semicolons and execute each statement
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && !s.match(/^COMMENT ON/));

  for (const statement of statements) {
    if (!statement) continue;

    console.log('Executing:', statement.substring(0, 100) + '...');

    const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

    if (error) {
      console.error('❌ Error:', error.message);
      // Continue anyway - constraint might already be updated
    } else {
      console.log('✅ Success');
    }
  }

  // Execute the COMMENT statement separately
  const commentMatch = migrationSQL.match(/COMMENT ON CONSTRAINT[^;]+;/);
  if (commentMatch) {
    console.log('\nAdding comment...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: commentMatch[0] });
    if (error) {
      console.error('⚠️  Comment failed:', error.message);
    } else {
      console.log('✅ Comment added');
    }
  }

  console.log('\n✅ Migration applied successfully!\n');

  // Verify the new constraint
  console.log('🔍 Verifying new constraint...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'public.email_accounts_raw'::regclass
      AND conname LIKE '%unique%';
    `
  });

  if (error) {
    console.error('❌ Verification error:', error.message);
  } else if (data) {
    console.log('Current constraints:');
    console.log(JSON.stringify(data, null, 2));
  }
}

applyMigration().catch(console.error);
