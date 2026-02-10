import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
  const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';

  console.log('\n🚀 Running Database Migrations...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read the consolidated migrations file
    const sqlPath = join(process.cwd(), 'ALL_MIGRATIONS.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('📄 Loaded ALL_MIGRATIONS.sql');
    console.log(`📏 File size: ${sql.length} characters\n`);

    // Execute the SQL via Supabase REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ Migration failed via REST API');
      console.log('Trying direct SQL execution...\n');

      // Alternative: Use Supabase client to execute SQL directly
      // This uses the pg connection pool
      const { data, error: sqlError } = await supabase.rpc('exec_sql', { query: sql });

      if (sqlError) {
        console.error('❌ SQL execution failed:', sqlError);
        console.log('\n⚠️  You may need to run the migrations manually in the Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new\n');
        console.log('   Copy the contents of ALL_MIGRATIONS.sql and paste them there.\n');
        return;
      }

      console.log('✅ Migrations executed successfully!');
    } else {
      console.log('✅ Migrations executed successfully via REST API!');
    }

    // Verify tables were created
    console.log('\n🔍 Verifying tables...\n');

    const tables = [
      'agent_runs',
      'lead_sources',
      'raw_leads',
      'cleaned_leads',
      'client_lead_batches',
      'site_credentials',
      'agent_errors',
      'batch_lead_assignments',
      'client_zipcodes',
      'monthly_cleaned_leads'
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(0);
      if (error) {
        console.log(`❌ Table '${table}' not found`);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }

    console.log('\n✅ Database setup complete!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n⚠️  Please run the migrations manually:');
    console.log('   1. Open: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new');
    console.log('   2. Copy contents of ALL_MIGRATIONS.sql');
    console.log('   3. Paste and click "Run"\n');
  }
}

runMigrations();
