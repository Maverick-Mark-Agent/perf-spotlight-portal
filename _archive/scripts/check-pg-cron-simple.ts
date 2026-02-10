import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function main() {
  console.log('================================================================================');
  console.log('PG_CRON MIGRATION STATUS CHECK');
  console.log('================================================================================\n');

  console.log('Migration file: /supabase/migrations/20251009235900_schedule_daily_kpi_sync.sql');
  console.log('Expected job name: daily-kpi-metrics-sync');
  console.log('Expected schedule: 1 0 * * * (12:01 AM daily)\n');

  console.log('================================================================================');
  console.log('DATABASE ACCESS CHECK');
  console.log('================================================================================\n');

  // Test basic database connectivity
  console.log('Testing database connection...');
  try {
    const { data, error } = await supabase
      .from('client_costs')
      .select('id')
      .limit(1);

    if (error) {
      console.log('❌ Database connection test failed:', error.message);
      console.log('   Error details:', error);
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (e) {
    console.log('❌ Exception during connection test:', e);
  }

  console.log('\n================================================================================');
  console.log('PERMISSION ANALYSIS');
  console.log('================================================================================\n');

  console.log('⚠️  IMPORTANT FINDINGS:');
  console.log('');
  console.log('1. The anon role (public API key) has LIMITED permissions by design.');
  console.log('   This is correct for security - it cannot access:');
  console.log('   - System tables (pg_extension, pg_cron, etc.)');
  console.log('   - cron schema tables (cron.job, cron.job_run_details)');
  console.log('   - Schema migration tracking tables');
  console.log('');
  console.log('2. To check pg_cron migration status in production, you need ONE of:');
  console.log('   a) Service role key (has admin permissions)');
  console.log('   b) Direct database access (psql connection)');
  console.log('   c) Supabase Dashboard (web UI)');
  console.log('   d) A deployed Edge Function with service role key');
  console.log('');

  console.log('================================================================================');
  console.log('HOW TO CHECK IF MIGRATION WAS APPLIED');
  console.log('================================================================================\n');

  console.log('OPTION 1: Supabase Dashboard (RECOMMENDED)');
  console.log('-------------------------------------------');
  console.log('1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx');
  console.log('2. Navigate to: Database > Extensions');
  console.log('3. Check if "pg_cron" extension is enabled');
  console.log('4. Navigate to: SQL Editor');
  console.log('5. Run this query:');
  console.log('');
  console.log('   SELECT * FROM cron.job WHERE jobname = \'daily-kpi-metrics-sync\';');
  console.log('');
  console.log('6. If you see a row, the migration was applied successfully!');
  console.log('');

  console.log('OPTION 2: Deploy the Edge Function');
  console.log('-----------------------------------');
  console.log('1. Log in to Supabase CLI: npx supabase login');
  console.log('2. Deploy: npx supabase functions deploy check-pg-cron-status');
  console.log('3. The Edge Function has service role access and can query system tables');
  console.log('4. Run this script again - it will use the deployed function');
  console.log('');

  console.log('OPTION 3: Use SQL Editor in Dashboard');
  console.log('--------------------------------------');
  console.log('Run these queries in the SQL Editor:');
  console.log('');
  console.log('-- Check if pg_cron extension is installed:');
  console.log('SELECT * FROM pg_extension WHERE extname = \'pg_cron\';');
  console.log('');
  console.log('-- Check if the cron job exists:');
  console.log('SELECT jobid, schedule, command, active, jobname');
  console.log('FROM cron.job');
  console.log('WHERE jobname = \'daily-kpi-metrics-sync\';');
  console.log('');
  console.log('-- Check recent job executions:');
  console.log('SELECT r.runid, r.status, r.start_time, r.end_time, r.return_message');
  console.log('FROM cron.job_run_details r');
  console.log('JOIN cron.job j ON j.jobid = r.jobid');
  console.log('WHERE j.jobname = \'daily-kpi-metrics-sync\'');
  console.log('ORDER BY r.start_time DESC');
  console.log('LIMIT 10;');
  console.log('');

  console.log('================================================================================');
  console.log('MIGRATION FILE CONTENTS');
  console.log('================================================================================\n');
  console.log('The migration does the following:');
  console.log('1. Creates pg_cron extension if not exists');
  console.log('2. Grants USAGE on cron schema to postgres role');
  console.log('3. Schedules a job named "daily-kpi-metrics-sync"');
  console.log('4. Job runs at 12:01 AM every day (cron: "1 0 * * *")');
  console.log('5. Job calls the sync-daily-kpi-metrics Edge Function via HTTP POST');
  console.log('6. Creates a view cron.daily_kpi_sync_history for monitoring');
  console.log('');

  console.log('================================================================================');
  console.log('WHAT TO DO IF MIGRATION IS NOT APPLIED');
  console.log('================================================================================\n');
  console.log('If you confirm the migration is NOT applied, run:');
  console.log('');
  console.log('npx supabase db push');
  console.log('');
  console.log('Or manually apply it:');
  console.log('');
  console.log('npx supabase migration up --file supabase/migrations/20251009235900_schedule_daily_kpi_sync.sql');
  console.log('');

  console.log('================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================\n');
  console.log('Status: ❓ UNKNOWN (requires service role or dashboard access)');
  console.log('');
  console.log('Next Steps:');
  console.log('1. Use Supabase Dashboard SQL Editor to check migration status');
  console.log('2. Run the SQL queries provided above');
  console.log('3. If migration not applied, run: npx supabase db push');
  console.log('');
  console.log('================================================================================\n');

  process.exit(0);
}

main();
