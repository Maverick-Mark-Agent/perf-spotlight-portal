import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const { Client } = pg;

async function runMigrations() {
  console.log('\n🚀 Running Database Migrations via PostgreSQL...\n');

  // Supabase connection string format:
  // postgresql://postgres:[YOUR-PASSWORD]@db.gjqbbgrfhijescaouqkx.supabase.co:5432/postgres

  // Using service role key to connect
  const connectionString = `postgresql://postgres.gjqbbgrfhijescaouqkx:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL\n');

    // Read the consolidated migrations file
    const sqlPath = join(process.cwd(), 'ALL_MIGRATIONS.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('📄 Loaded ALL_MIGRATIONS.sql');
    console.log(`📏 File size: ${sql.length} characters\n`);
    console.log('⏳ Executing SQL...\n');

    // Execute the entire SQL file
    await client.query(sql);

    console.log('✅ Migrations executed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');

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
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )`,
        [table]
      );

      if (result.rows[0].exists) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' not found`);
      }
    }

    console.log('\n✅ Database setup complete!\n');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.log('\n⚠️  PostgreSQL password authentication failed.');
      console.log('   The service role key cannot be used as a password.\n');
      console.log('💡 Please run migrations manually in Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new\n');
    } else {
      console.error('Full error:', error);
    }
  } finally {
    await client.end();
  }
}

runMigrations();
