import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.yaez3rq1VHStAH9dV0lLJtd-tyOnJcwYhzHSr7fX1XA'
);

async function applyFix() {
  console.log('🔧 Applying final fix to get_user_workspaces function\n');

  // Read the SQL
  const sql = readFileSync('/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/FINAL_FIX.sql', 'utf-8');

  console.log('📝 SQL to execute:');
  console.log(sql);
  console.log('\n' + '='.repeat(60) + '\n');

  // Test BEFORE fix
  console.log('1️⃣ Testing Jeremy BEFORE fix...');
  const jeremyId = '656bc47a-2296-4c0c-977d-d0a51ce8b713';

  try {
    const { data: before, error: beforeError } = await supabase
      .rpc('get_user_workspaces', { p_user_id: jeremyId });

    if (beforeError) {
      console.log(`   ❌ Error: ${beforeError.message} (${beforeError.code})`);
    } else {
      console.log(`   ✅ Returns ${before?.length || 0} workspaces`);
    }
  } catch (e: any) {
    console.log(`   ❌ Exception: ${e.message}`);
  }

  console.log('\n2️⃣ Applying fix...\n');
  console.log('⚠️  Direct SQL execution via Supabase JS client is not supported.');
  console.log('📋 COPY AND RUN THIS SQL IN SUPABASE SQL EDITOR:\n');
  console.log('---');
  console.log(sql);
  console.log('---\n');

  console.log('After running the SQL, the function will be fixed and:');
  console.log('  ✅ Clients will see only their assigned workspaces');
  console.log('  ✅ Admins will see ALL workspaces\n');
}

applyFix();
