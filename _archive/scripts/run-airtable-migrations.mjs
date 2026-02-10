import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL(sql, name) {
  console.log(`\n🔄 Running: ${name}`);

  try {
    // For Supabase, we need to use their RPC or just execute via the client
    // Since supabase-js doesn't have a direct SQL execution method,
    // we'll use fetch to the REST API with the SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Failed: ${name}`);
      console.error(`Status: ${response.status}`);
      console.error(`Response:`, text);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Success: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ Error: ${name}`, error.message);
    return false;
  }
}

async function checkSchema() {
  console.log('\n📋 Checking current schema...');

  const { data, error } = await supabase
    .from('client_registry')
    .select('monthly_sending_target, payout')
    .limit(1);

  if (error && error.code !== 'PGRST116') {
    console.log('⚠️  client_registry may not have required columns yet');
    return false;
  }

  console.log('✅ Schema check complete');
  return true;
}

async function main() {
  console.log('🚀 Starting Airtable Replacement Migrations\n');
  console.log('=' .repeat(60));

  // Check current schema first
  await checkSchema();

  // Read migration files
  const migration1Path = join(projectRoot, 'supabase/migrations/20251006020000_add_monthly_sending_target.sql');
  const migration2Path = join(projectRoot, 'supabase/migrations/20251006030000_complete_airtable_replacement.sql');

  const migration1 = readFileSync(migration1Path, 'utf-8');
  const migration2 = readFileSync(migration2Path, 'utf-8');

  // Run migrations
  const success1 = await runSQL(migration1, '20251006020000_add_monthly_sending_target');
  const success2 = await runSQL(migration2, '20251006030000_complete_airtable_replacement');

  console.log('\n' + '='.repeat(60));
  if (success1 && success2) {
    console.log('✅ All migrations completed successfully!');
  } else {
    console.log('⚠️  Some migrations may have failed. Check output above.');
  }

  // Verify schema
  console.log('\n📋 Verifying schema...');

  const { data: metrics, error: metricsError } = await supabase
    .from('client_metrics')
    .select('*')
    .limit(1);

  if (!metricsError) {
    console.log('✅ client_metrics table exists');
  } else {
    console.log('❌ client_metrics table check failed:', metricsError.message);
  }

  const { data: registry, error: registryError } = await supabase
    .from('client_registry')
    .select('monthly_sending_target, payout')
    .limit(1);

  if (!registryError || (registryError && !registryError.message.includes('does not exist'))) {
    console.log('✅ client_registry has required columns');
  } else {
    console.log('❌ client_registry columns check failed:', registryError?.message);
  }

  console.log('\n🎉 Migration script complete!\n');
}

main().catch(console.error);
