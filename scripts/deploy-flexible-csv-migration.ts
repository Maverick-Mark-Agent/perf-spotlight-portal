import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployMigration() {
  console.log('📦 Deploying flexible CSV support migration...\n');

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251014100000_add_flexible_csv_support.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
    console.log(statement.substring(0, 100) + '...\n');

    const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

    if (error) {
      // If exec_sql doesn't exist, we need to run this manually
      if (error.code === 'PGRST202') {
        console.log('⚠️  exec_sql RPC not available. Creating manual SQL file...\n');

        const manualSqlPath = path.join(__dirname, '..', 'MANUAL_RUN_flexible_csv_migration.sql');
        fs.writeFileSync(manualSqlPath, sql);

        console.log('✅ Created MANUAL_RUN_flexible_csv_migration.sql');
        console.log('\n📋 Please run this file manually in Supabase SQL Editor:');
        console.log('   1. Go to https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new');
        console.log('   2. Copy contents of MANUAL_RUN_flexible_csv_migration.sql');
        console.log('   3. Paste and run\n');
        return;
      }

      console.error(`❌ Error on statement ${i + 1}:`, error);
      throw error;
    }

    console.log('✅ Success');
  }

  console.log('\n✅ Migration deployed successfully!');
}

deployMigration().catch(console.error);
