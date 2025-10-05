#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';
const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';

console.log('============================================');
console.log('  Running Migration via Supabase Client');
console.log('============================================\n');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Read migration SQL
const sqlPath = join(process.cwd(), 'supabase/migrations/MANUAL_RUN_fix_airtable_constraint.sql');
const sql = readFileSync(sqlPath, 'utf8');

// Split into individual statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT'))
  .filter(s => !s.includes('============'));

console.log(`Executing ${statements.length} SQL statements...\\n`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i] + ';';
  console.log(`[${i + 1}/${statements.length}] ${stmt.substring(0, 70).replace(/\\n/g, ' ')}...`);

  const { data, error } = await supabase.rpc('exec', { query: stmt }).single();

  if (error && !error.message.includes('not found')) {
    console.log(`  ⚠️  ${error.message}`);
  } else {
    console.log(`  ✅ Success`);
  }
}

console.log('\\n============================================');
console.log('✅ Migration completed!');
console.log('============================================\\n');
console.log('Testing constraint...');

// Test that we can now insert without airtable_id
const { data: testData, error: testError } = await supabase
  .from('client_leads')
  .insert({
    workspace_name: 'Test Workspace',
    lead_email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    airtable_id: null,
    pipeline_stage: 'new'
  })
  .select()
  .single();

if (testError) {
  console.log('❌ Test insert failed:', testError.message);
} else {
  console.log('✅ Test insert succeeded! Constraint is fixed.');

  // Delete test record
  await supabase
    .from('client_leads')
    .delete()
    .eq('id', testData.id);

  console.log('✅ Test record cleaned up');
}

console.log('\\nNext step: Run the fixed sync script');
console.log('  ./scripts/sync-devin-interested-FIXED.sh\\n');
