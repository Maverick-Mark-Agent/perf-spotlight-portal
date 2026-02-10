import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  const PROJECT_REF = 'gjqbbgrfhijescaouqkx';
  const ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';

  console.log('\n🚀 Running Database Migrations via Supabase Management API...\n');

  try {
    // Read the agent tables migration
    const migration1Path = join(process.cwd(), 'supabase/migrations/20251005200000_create_agent_tables.sql');
    const migration2Path = join(process.cwd(), 'supabase/migrations/20251005203000_create_client_zipcodes.sql');
    const migration3Path = join(process.cwd(), 'supabase/migrations/20251005203100_create_monthly_cleaned_leads.sql');

    const migrations = [
      { name: '20251005200000_create_agent_tables.sql', sql: readFileSync(migration1Path, 'utf-8') },
      { name: '20251005203000_create_client_zipcodes.sql', sql: readFileSync(migration2Path, 'utf-8') },
      { name: '20251005203100_create_monthly_cleaned_leads.sql', sql: readFileSync(migration3Path, 'utf-8') }
    ];

    for (const migration of migrations) {
      console.log(`📄 Executing ${migration.name}...`);
      console.log(`   Size: ${migration.sql.length} characters\n`);

      // Use Supabase Management API to execute SQL
      const response = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: migration.sql
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${migration.name} executed successfully!\n`);
      } else {
        const error = await response.text();
        console.log(`❌ ${migration.name} failed:`, error.substring(0, 200), '\n');
      }
    }

    console.log('\n🔍 Verifying tables...\n');

    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
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
  }
}

runMigrations();
