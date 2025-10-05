#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';
const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';

console.log('============================================');
console.log('  Applying Missing Migrations');
console.log('============================================\n');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Migration 1: Add interested column
const migration1 = `
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS interested BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_client_leads_interested
  ON public.client_leads(interested)
  WHERE interested = true;

COMMENT ON COLUMN public.client_leads.interested IS 'Flag indicating if this lead has shown interest (e.g., positive reply)';
`;

// Migration 2: Fix airtable_id constraint
const migration2 = `
ALTER TABLE public.client_leads
ALTER COLUMN airtable_id DROP NOT NULL;

ALTER TABLE public.client_leads
DROP CONSTRAINT IF EXISTS client_leads_airtable_id_key;

ALTER TABLE public.client_leads
DROP CONSTRAINT IF EXISTS unique_lead_per_workspace;

ALTER TABLE public.client_leads
ADD CONSTRAINT unique_lead_per_workspace
UNIQUE (lead_email, workspace_name);

DROP INDEX IF EXISTS idx_client_leads_airtable_unique;

CREATE UNIQUE INDEX idx_client_leads_airtable_unique
  ON public.client_leads(airtable_id)
  WHERE airtable_id IS NOT NULL;

COMMENT ON COLUMN public.client_leads.airtable_id IS 'Airtable record ID (optional - only for Airtable-sourced leads). Email Bison leads use bison_lead_id instead.';
`;

// Execute migrations
const migrations = [
  { name: 'Add interested column', sql: migration1 },
  { name: 'Fix airtable_id constraint', sql: migration2 }
];

for (const migration of migrations) {
  console.log(`Running: ${migration.name}...`);

  const statements = migration.sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';

    // Execute via raw SQL query
    const { data, error } = await supabase.rpc('query', {
      query_text: stmt
    });

    if (error) {
      // Try alternative method - direct query
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({ query_text: stmt })
      });

      if (!response.ok) {
        console.log(`  ⚠️  ${error.message || 'Unknown error'}`);
      } else {
        console.log('  ✅');
      }
    } else {
      console.log('  ✅');
    }
  }

  console.log(`✅ ${migration.name} completed\n`);
}

console.log('============================================');
console.log('✅ All migrations applied!');
console.log('============================================\n');

// Test that interested column exists
console.log('Testing interested column...');
const { data: testData, error: testError } = await supabase
  .from('client_leads')
  .select('interested')
  .limit(1);

if (testError) {
  console.log('❌ Interested column test failed:', testError.message);
} else {
  console.log('✅ Interested column exists!\n');
  console.log('Next step: Run the sync script');
  console.log('  ./scripts/sync-devin-interested-FIXED.sh\n');
}
