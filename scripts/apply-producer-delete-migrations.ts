#!/usr/bin/env npx tsx

// Apply producer assignment and soft-delete migrations to production

const SUPABASE_PROJECT_REF = 'gjqbbgrfhijescaouqkx';
const SUPABASE_ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';

async function runQuery(query: string, description: string) {
  console.log(`Applying: ${description}...`);

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error: ${errorText}`);
    throw new Error(`Failed to run query: ${response.statusText}`);
  }

  const result = await response.json();
  console.log(`✅ ${description} - Success`);
  return result;
}

async function main() {
  console.log('=== Applying Producer Assignment & Soft-Delete Migrations ===\n');

  // Migration 1: Producer assignment columns
  await runQuery(`
    ALTER TABLE public.client_leads
      ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  `, 'Add producer assignment columns');

  // Index for producer queries
  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_client_leads_assigned_to
      ON public.client_leads(assigned_to_user_id);
  `, 'Create assigned_to_user_id index');

  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_client_leads_workspace_assigned
      ON public.client_leads(workspace_name, assigned_to_user_id);
  `, 'Create workspace + assigned index');

  // Migration 2: Soft-delete columns
  await runQuery(`
    ALTER TABLE public.client_leads
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
  `, 'Add soft-delete columns');

  // Indexes for deleted leads queries
  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_client_leads_not_deleted
      ON public.client_leads(workspace_name, deleted_at)
      WHERE deleted_at IS NULL;
  `, 'Create non-deleted leads index');

  await runQuery(`
    CREATE INDEX IF NOT EXISTS idx_client_leads_deleted
      ON public.client_leads(workspace_name, deleted_at)
      WHERE deleted_at IS NOT NULL;
  `, 'Create deleted leads index');

  console.log('\n=== All Migrations Applied Successfully! ===');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
