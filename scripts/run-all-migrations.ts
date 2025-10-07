import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

async function runAllMigrations() {
  const PROJECT_REF = 'gjqbbgrfhijescaouqkx';
  const ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';

  const allMigrationsPath = join(process.cwd(), 'ALL_MIGRATIONS.sql');
  const sql = readFileSync(allMigrationsPath, 'utf-8');

  console.log('\n🚀 Executing ALL migrations as single transaction...\n');
  console.log(`📏 Total SQL size: ${sql.length} characters\n`);

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      }
    );

    if (response.ok) {
      console.log('✅ All migrations executed successfully!\n');
    } else {
      const error = await response.text();
      console.log('❌ Migration failed:', error, '\n');
    }

    // Verify tables
    console.log('🔍 Verifying tables...\n');

    const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
    const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    let successCount = 0;
    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(0);
      if (error) {
        console.log(`❌ Table '${table}' not found`);
      } else {
        console.log(`✅ Table '${table}' exists`);
        successCount++;
      }
    }

    console.log(`\n📊 Result: ${successCount}/${tables.length} tables created\n`);

    if (successCount === tables.length) {
      console.log('🎉 Database setup complete! All agent tables are ready.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

runAllMigrations();
