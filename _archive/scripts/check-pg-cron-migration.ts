import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

// Create a Node.js compatible client without localStorage
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

interface MigrationCheckResult {
  migrationApplied: boolean;
  migrationDetails?: any;
  cronJobExists: boolean | null;
  cronJobDetails?: any;
  cronSchemaExists: boolean | null;
  cronExtensionInstalled: boolean | null;
  permissionLevel: string;
  errors: string[];
  recommendations: string[];
}

async function checkPgCronMigration(): Promise<MigrationCheckResult> {
  const result: MigrationCheckResult = {
    migrationApplied: false,
    cronJobExists: null,
    cronSchemaExists: null,
    cronExtensionInstalled: null,
    permissionLevel: 'unknown',
    errors: [],
    recommendations: [],
  };

  console.log('🔍 Checking pg_cron migration status...\n');

  // Helper function to execute raw SQL
  const execSQL = async (query: string): Promise<any> => {
    const { data, error } = await supabase.rpc('exec_sql', { sql: query });
    if (error) throw error;
    return data;
  };

  // 1. Check if migration was applied by checking if exec_sql function exists
  console.log('1️⃣  Checking database connectivity and exec_sql function...');
  try {
    // First, try a simple query to test connectivity
    const { data: testData, error: testError } = await supabase
      .from('client_registry')
      .select('id')
      .limit(1);

    if (testError) {
      console.log('   ❌ Database connection test failed:', testError.message);
      result.errors.push(`Database connection failed: ${testError.message}`);
    } else {
      console.log('   ✅ Database connection successful');
    }

    // Check if exec_sql function exists
    const { data: funcData, error: funcError } = await supabase.rpc('exec_sql', {
      sql: 'SELECT 1 as test'
    });

    if (funcError) {
      console.log('   ⚠️  exec_sql function not available:', funcError.message);
      console.log('   ℹ️  Will use limited queries only');
      result.permissionLevel = 'limited - no exec_sql';
    } else {
      console.log('   ✅ exec_sql function is available');
      result.permissionLevel = 'full - has exec_sql';
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log('   ❌ Exception:', errorMsg);
    result.errors.push(`Exception testing connection: ${errorMsg}`);
  }

  // 2. Check if pg_cron extension is installed
  console.log('\n2️⃣  Checking if pg_cron extension is installed...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: "SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron'"
    });

    if (error) {
      console.log('   ❌ Error checking pg_cron extension:', error.message);
      result.errors.push(`pg_extension query failed: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log('   ✅ pg_cron extension IS installed!');
      console.log('   📄 Extension details:', JSON.stringify(data[0], null, 2));
      result.cronExtensionInstalled = true;
    } else {
      console.log('   ❌ pg_cron extension NOT found');
      result.cronExtensionInstalled = false;
      result.recommendations.push('pg_cron extension needs to be installed');
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log('   ⚠️  Cannot check pg_cron extension (exec_sql not available)');
    result.cronExtensionInstalled = null;
  }

  // 3. Check if cron schema exists
  console.log('\n3️⃣  Checking if cron schema exists...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'cron'"
    });

    if (error) {
      console.log('   ❌ Error checking cron schema:', error.message);
      result.errors.push(`cron schema check failed: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log('   ✅ cron schema EXISTS!');
      result.cronSchemaExists = true;
    } else {
      console.log('   ❌ cron schema NOT found');
      result.cronSchemaExists = false;
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log('   ⚠️  Cannot check cron schema (exec_sql not available)');
    result.cronSchemaExists = null;
  }

  // 4. Check if the cron job exists
  console.log('\n4️⃣  Checking if daily-kpi-metrics-sync job exists in cron.job...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
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
      console.log('   ❌ Error querying cron jobs:', error.message);
      result.errors.push(`cron.job query failed: ${error.message}`);
      result.cronJobExists = null;
    } else if (data && data.length > 0) {
      console.log('   ✅ daily-kpi-metrics-sync job EXISTS!');
      console.log('   📄 Job details:', JSON.stringify(data[0], null, 2));
      result.cronJobExists = true;
      result.cronJobDetails = data[0];
      result.migrationApplied = true; // If the job exists, migration was applied
    } else {
      console.log('   ❌ daily-kpi-metrics-sync job NOT found');
      result.cronJobExists = false;
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log('   ⚠️  Cannot check cron jobs (exec_sql not available or no permissions)');
    result.cronJobExists = null;
  }

  // 5. Check recent cron job runs
  console.log('\n5️⃣  Checking recent cron job execution history...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          run.jobid,
          run.runid,
          run.status,
          run.return_message,
          run.start_time,
          run.end_time,
          EXTRACT(EPOCH FROM (run.end_time - run.start_time)) AS duration_seconds
        FROM cron.job_run_details run
        JOIN cron.job j ON j.jobid = run.jobid
        WHERE j.jobname = 'daily-kpi-metrics-sync'
        ORDER BY run.start_time DESC
        LIMIT 5
      `
    });

    if (error) {
      console.log('   ⚠️  Cannot access cron job run history:', error.message);
    } else if (data && data.length > 0) {
      console.log('   ✅ Found recent job executions!');
      console.log('   📄 Recent runs (last 5):');
      data.forEach((run: any, idx: number) => {
        console.log(`      ${idx + 1}. Status: ${run.status}, Start: ${run.start_time}, Duration: ${run.duration_seconds}s`);
        if (run.return_message) {
          console.log(`         Message: ${run.return_message}`);
        }
      });
    } else {
      console.log('   ℹ️  No execution history found (job may not have run yet)');
    }
  } catch (e) {
    console.log('   ⚠️  Cannot check execution history');
  }

  // Generate recommendations
  console.log('\n📋 Generating recommendations...');

  if (!result.migrationApplied) {
    result.recommendations.push('⚠️  Apply migration 20251009235900 to set up pg_cron');
  }

  if (result.cronExtensionInstalled === false) {
    result.recommendations.push('⚠️  Install pg_cron extension in production database');
  }

  if (result.cronJobExists === false && result.migrationApplied) {
    result.recommendations.push('⚠️  Migration applied but cron job not found - check migration execution');
  }

  if (result.permissionLevel === 'no direct cron access') {
    result.recommendations.push('ℹ️  Limited permissions for cron tables - this is normal for security');
    result.recommendations.push('ℹ️  Consider creating a Supabase Edge Function to check cron job status');
  }

  if (result.errors.length === 0 && result.migrationApplied && result.cronJobExists) {
    result.recommendations.push('✅ Everything looks good! pg_cron is properly configured');
  }

  return result;
}

// Main execution - try Edge Function first, fall back to direct queries
async function main() {
  try {
    console.log('Attempting to check pg_cron status via Edge Function...\n');

    // Try calling the Edge Function first
    const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke(
      'check-pg-cron-status',
      { body: {} }
    );

    if (!edgeFunctionError && edgeFunctionData) {
      console.log('✅ Successfully retrieved status from Edge Function!\n');
      const result = edgeFunctionData;

      console.log('='.repeat(80));
      console.log('📊 FINAL REPORT (via Edge Function with service_role)');
      console.log('='.repeat(80));
      console.log('\n✓ Migration Applied:', result.migrationApplied ? '✅ YES' : '❌ NO');
      console.log('✓ Cron Job Exists:',
        result.cronJobExists === true ? '✅ YES' :
        result.cronJobExists === false ? '❌ NO' :
        '❓ UNKNOWN (permissions)'
      );
      console.log('✓ Cron Schema Exists:',
        result.cronSchemaExists === true ? '✅ YES' :
        result.cronSchemaExists === false ? '❌ NO' :
        '❓ UNKNOWN'
      );
      console.log('✓ Cron Extension Installed:',
        result.cronExtensionInstalled === true ? '✅ YES' :
        result.cronExtensionInstalled === false ? '❌ NO' :
        '❓ UNKNOWN'
      );
      console.log('✓ Permission Level:', result.permissionLevel);

      if (result.cronJobDetails) {
        console.log('\n📄 Cron Job Details:');
        console.log('   Job ID:', result.cronJobDetails.jobid);
        console.log('   Schedule:', result.cronJobDetails.schedule);
        console.log('   Active:', result.cronJobDetails.active);
        console.log('   Database:', result.cronJobDetails.database);
        console.log('   Command (truncated):', result.cronJobDetails.command?.substring(0, 100) + '...');
      }

      if (result.recentRuns && result.recentRuns.length > 0) {
        console.log('\n📜 Recent Job Executions (last 5):');
        result.recentRuns.forEach((run: any, idx: number) => {
          console.log(`   ${idx + 1}. Run ID: ${run.runid}`);
          console.log(`      Status: ${run.status}`);
          console.log(`      Start: ${run.start_time}`);
          console.log(`      Duration: ${run.duration_seconds}s`);
          if (run.return_message) {
            console.log(`      Message: ${run.return_message}`);
          }
          console.log('');
        });
      } else if (result.cronJobExists) {
        console.log('\n📜 Job Execution History: None yet (job may not have run at scheduled time)');
      }

      if (result.errors.length > 0) {
        console.log('\n⚠️  Errors Encountered:');
        result.errors.forEach((error: string, idx: number) => {
          console.log(`   ${idx + 1}. ${error}`);
        });
      }

      if (result.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        result.recommendations.forEach((rec: string, idx: number) => {
          console.log(`   ${idx + 1}. ${rec}`);
        });
      }

      console.log('\n' + '='.repeat(80));
      process.exit(0);
    } else {
      // Edge Function failed, try direct queries
      console.log('⚠️  Edge Function not available or failed:', edgeFunctionError?.message);
      console.log('Falling back to direct database queries...\n');

      const result = await checkPgCronMigration();

      console.log('\n' + '='.repeat(80));
      console.log('📊 FINAL REPORT (via direct queries - limited permissions)');
      console.log('='.repeat(80));
      console.log('\n✓ Migration Applied:', result.migrationApplied ? '✅ YES' : '❌ NO');
      console.log('✓ Cron Job Exists:',
        result.cronJobExists === true ? '✅ YES' :
        result.cronJobExists === false ? '❌ NO' :
        '❓ UNKNOWN (permissions)'
      );
      console.log('✓ Cron Schema Exists:',
        result.cronSchemaExists === true ? '✅ YES' :
        result.cronSchemaExists === false ? '❌ NO' :
        '❓ UNKNOWN'
      );
      console.log('✓ Cron Extension Installed:',
        result.cronExtensionInstalled === true ? '✅ YES' :
        result.cronExtensionInstalled === false ? '❌ NO' :
        '❓ UNKNOWN'
      );
      console.log('✓ Permission Level:', result.permissionLevel);

      if (result.errors.length > 0) {
        console.log('\n⚠️  Errors Encountered:');
        result.errors.forEach((error, idx) => {
          console.log(`   ${idx + 1}. ${error}`);
        });
      }

      if (result.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        result.recommendations.forEach((rec, idx) => {
          console.log(`   ${idx + 1}. ${rec}`);
        });
      }

      console.log('\n' + '='.repeat(80));
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
