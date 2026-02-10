import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";

// Check if service role key is provided via environment variable
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('================================================================================');
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.error('================================================================================\n');
  console.error('To use this script, you need the service role key.');
  console.error('');
  console.error('Get it from: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/settings/api');
  console.error('');
  console.error('Then run:');
  console.error('');
  console.error('export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"');
  console.error('npx tsx scripts/check-pg-cron-with-service-key.ts');
  console.error('');
  console.error('Or in one command:');
  console.error('');
  console.error('SUPABASE_SERVICE_ROLE_KEY="your-key" npx tsx scripts/check-pg-cron-with-service-key.ts');
  console.error('');
  console.error('================================================================================\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function checkPgCronStatus() {
  console.log('================================================================================');
  console.log('PG_CRON MIGRATION STATUS CHECK (with service role)');
  console.log('================================================================================\n');

  const results = {
    migrationApplied: false,
    extensionInstalled: false,
    cronSchemaExists: false,
    jobExists: false,
    jobDetails: null as any,
    recentRuns: [] as any[],
    errors: [] as string[],
  };

  // 1. Check if pg_cron extension is installed
  console.log('1. Checking pg_cron extension...');
  try {
    // Use raw SQL query via RPC
    const { data, error } = await supabase.rpc('query', {
      query_text: "SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron'"
    });

    if (error) {
      console.log('   ❌ Error:', error.message);
      results.errors.push(`pg_cron extension check failed: ${error.message}`);

      // Try alternative: direct table access
      console.log('   Trying alternative method...');
      const { data: extData, error: extError } = await supabase
        .from('pg_extension')
        .select('extname, extversion')
        .eq('extname', 'pg_cron')
        .maybeSingle();

      if (extError) {
        console.log('   ❌ Alternative method also failed:', extError.message);
      } else if (extData) {
        console.log('   ✅ pg_cron extension IS installed!');
        console.log('      Version:', extData.extversion);
        results.extensionInstalled = true;
      } else {
        console.log('   ❌ pg_cron extension NOT installed');
      }
    } else if (data && Array.isArray(data) && data.length > 0) {
      console.log('   ✅ pg_cron extension IS installed!');
      console.log('      Version:', data[0].extversion);
      results.extensionInstalled = true;
    } else {
      console.log('   ❌ pg_cron extension NOT installed');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('   ❌ Exception:', msg);
    results.errors.push(`Exception checking extension: ${msg}`);
  }

  // 2. Check if cron schema exists
  console.log('\n2. Checking cron schema...');
  try {
    const { data, error } = await supabase.rpc('query', {
      query_text: "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'cron'"
    });

    if (error) {
      console.log('   ❌ Error:', error.message);
      results.errors.push(`cron schema check failed: ${error.message}`);
    } else if (data && Array.isArray(data) && data.length > 0) {
      console.log('   ✅ cron schema EXISTS');
      results.cronSchemaExists = true;
    } else {
      console.log('   ❌ cron schema NOT found');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('   ❌ Exception:', msg);
    results.errors.push(`Exception checking schema: ${msg}`);
  }

  // 3. Check if the cron job exists
  console.log('\n3. Checking daily-kpi-metrics-sync cron job...');
  try {
    const { data, error } = await supabase.rpc('query', {
      query_text: `
        SELECT
          jobid,
          schedule,
          command,
          nodename,
          nodeport,
          database,
          username,
          active,
          jobname
        FROM cron.job
        WHERE jobname = 'daily-kpi-metrics-sync'
      `
    });

    if (error) {
      console.log('   ❌ Error:', error.message);
      results.errors.push(`cron job check failed: ${error.message}`);
    } else if (data && Array.isArray(data) && data.length > 0) {
      console.log('   ✅ daily-kpi-metrics-sync job EXISTS!');
      console.log('      Job ID:', data[0].jobid);
      console.log('      Schedule:', data[0].schedule);
      console.log('      Active:', data[0].active);
      console.log('      Database:', data[0].database);
      results.jobExists = true;
      results.jobDetails = data[0];
      results.migrationApplied = true;
    } else {
      console.log('   ❌ daily-kpi-metrics-sync job NOT found');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('   ❌ Exception:', msg);
    results.errors.push(`Exception checking job: ${msg}`);
  }

  // 4. Check recent job runs
  if (results.jobExists) {
    console.log('\n4. Checking job execution history...');
    try {
      const { data, error } = await supabase.rpc('query', {
        query_text: `
          SELECT
            r.runid,
            r.status,
            r.return_message,
            r.start_time,
            r.end_time,
            EXTRACT(EPOCH FROM (r.end_time - r.start_time)) AS duration_seconds
          FROM cron.job_run_details r
          JOIN cron.job j ON j.jobid = r.jobid
          WHERE j.jobname = 'daily-kpi-metrics-sync'
          ORDER BY r.start_time DESC
          LIMIT 10
        `
      });

      if (error) {
        console.log('   ⚠️  Cannot access job history:', error.message);
      } else if (data && Array.isArray(data) && data.length > 0) {
        console.log(`   ✅ Found ${data.length} job execution(s):`);
        results.recentRuns = data;
        data.forEach((run, idx) => {
          console.log(`\n      Run #${idx + 1}:`);
          console.log('      - Run ID:', run.runid);
          console.log('      - Status:', run.status);
          console.log('      - Start Time:', run.start_time);
          console.log('      - Duration:', run.duration_seconds, 'seconds');
          if (run.return_message) {
            console.log('      - Message:', run.return_message);
          }
        });
      } else {
        console.log('   ℹ️  No execution history found (job may not have run yet)');
        console.log('      Job is scheduled for 12:01 AM daily');
      }
    } catch (e) {
      console.log('   ⚠️  Could not check execution history');
    }
  }

  return results;
}

async function main() {
  try {
    const results = await checkPgCronStatus();

    console.log('\n================================================================================');
    console.log('SUMMARY');
    console.log('================================================================================\n');

    console.log('Migration Applied:     ', results.migrationApplied ? '✅ YES' : '❌ NO');
    console.log('pg_cron Extension:     ', results.extensionInstalled ? '✅ Installed' : '❌ Not Installed');
    console.log('cron Schema:           ', results.cronSchemaExists ? '✅ EXISTS' : '❌ Missing');
    console.log('Cron Job Exists:       ', results.jobExists ? '✅ YES' : '❌ NO');
    console.log('Job Executions:        ', results.recentRuns.length > 0 ? `✅ ${results.recentRuns.length} found` : 'ℹ️  None yet');

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    }

    console.log('\n================================================================================');
    console.log('RECOMMENDATIONS');
    console.log('================================================================================\n');

    if (!results.extensionInstalled) {
      console.log('❌ CRITICAL: pg_cron extension is not installed');
      console.log('   Action: Run migration or execute: CREATE EXTENSION IF NOT EXISTS pg_cron;');
    } else if (!results.jobExists) {
      console.log('⚠️  WARNING: pg_cron is installed but job is missing');
      console.log('   Action: Apply migration 20251009235900_schedule_daily_kpi_sync.sql');
      console.log('   Command: npx supabase db push');
    } else if (results.recentRuns.length === 0) {
      console.log('✅ Job is properly configured!');
      console.log('   ℹ️  Job has not executed yet (scheduled for 12:01 AM daily)');
      console.log('   Next run: Tomorrow at 12:01 AM');
    } else {
      console.log('✅ SUCCESS! pg_cron is fully operational');
      console.log(`   Job has run ${results.recentRuns.length} time(s)`);
      console.log('   Latest status:', results.recentRuns[0].status);
    }

    console.log('\n================================================================================\n');

    process.exit(results.migrationApplied ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
