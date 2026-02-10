import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration(filename: string, sql: string) {
  console.log(`\n=== Applying ${filename} ===`);

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error(`❌ Error applying ${filename}:`, error);
      return false;
    }

    console.log(`✅ Successfully applied ${filename}`);
    return true;
  } catch (err) {
    console.error(`❌ Exception applying ${filename}:`, err);
    return false;
  }
}

async function main() {
  console.log('=== Applying Contact Pipeline Migrations ===\n');

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

  const migrations = [
    '20251014000000_add_clean_contact_target.sql',
    '20251014000001_update_pipeline_summary_view.sql',
    '20251014000002_ensure_zip_clients_home_insurance.sql',
  ];

  let successCount = 0;
  let failCount = 0;

  for (const filename of migrations) {
    const filepath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filepath, 'utf-8');

    const success = await applyMigration(filename, sql);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.');
    console.log('You may need to apply them manually in the Supabase SQL Editor.');
    process.exit(1);
  } else {
    console.log('\n🎉 All migrations applied successfully!');
  }
}

main().catch(console.error);
