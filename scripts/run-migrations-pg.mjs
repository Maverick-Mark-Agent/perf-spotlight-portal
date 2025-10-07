import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Supabase connection string (pooler mode)
const connectionString = 'postgresql://postgres.gjqbbgrfhijescaouqkx:Chucknorris1@@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

async function runMigration(client, sql, name) {
  console.log(`\n🔄 Running: ${name}`);

  try {
    await client.query(sql);
    console.log(`✅ Success: ${name}`);
    return true;
  } catch (error) {
    // Some errors are OK (like "already exists")
    if (error.message.includes('already exists')) {
      console.log(`ℹ️  Already exists: ${name} (skipping)`);
      return true;
    }
    console.error(`❌ Error: ${name}`);
    console.error(error.message);
    return false;
  }
}

async function main() {
  const client = new pg.Client({ connectionString });

  try {
    console.log('🚀 Starting Airtable Replacement Migrations\n');
    console.log('=' .repeat(60));

    await client.connect();
    console.log('✅ Connected to Supabase\n');

    // Read migration files
    const migration1Path = join(projectRoot, 'supabase/migrations/20251006020000_add_monthly_sending_target.sql');
    const migration2Path = join(projectRoot, 'supabase/migrations/20251006030000_complete_airtable_replacement.sql');

    const migration1 = readFileSync(migration1Path, 'utf-8');
    const migration2 = readFileSync(migration2Path, 'utf-8');

    // Run migrations
    const success1 = await runMigration(client, migration1, '20251006020000_add_monthly_sending_target');
    const success2 = await runMigration(client, migration2, '20251006030000_complete_airtable_replacement');

    console.log('\n' + '='.repeat(60));

    // Verify schema
    console.log('\n📋 Verifying schema...\n');

    // Check client_metrics table
    const metricsCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'client_metrics'
      ) as exists;
    `);
    if (metricsCheck.rows[0].exists) {
      console.log('✅ client_metrics table exists');
    } else {
      console.log('❌ client_metrics table does not exist');
    }

    // Check campaigns table
    const campaignsCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaigns'
      ) as exists;
    `);
    if (campaignsCheck.rows[0].exists) {
      console.log('✅ campaigns table exists');
    } else {
      console.log('❌ campaigns table does not exist');
    }

    // Check client_registry columns
    const sendingTargetCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_registry' AND column_name = 'monthly_sending_target'
      ) as exists;
    `);
    if (sendingTargetCheck.rows[0].exists) {
      console.log('✅ client_registry.monthly_sending_target exists');
    } else {
      console.log('❌ client_registry.monthly_sending_target does not exist');
    }

    const payoutCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_registry' AND column_name = 'payout'
      ) as exists;
    `);
    if (payoutCheck.rows[0].exists) {
      console.log('✅ client_registry.payout exists');
    } else {
      console.log('❌ client_registry.payout does not exist');
    }

    // Check views
    const viewCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'client_dashboard_data'
      ) as exists;
    `);
    if (viewCheck.rows[0].exists) {
      console.log('✅ client_dashboard_data view exists');
    } else {
      console.log('❌ client_dashboard_data view does not exist');
    }

    console.log('\n' + '='.repeat(60));
    if (success1 && success2) {
      console.log('✅ All migrations completed successfully!');
    } else {
      console.log('⚠️  Some migrations had errors (check above for details)');
    }

    console.log('\n🎉 Migration script complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
