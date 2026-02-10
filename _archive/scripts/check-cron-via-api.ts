import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCronJobStatus() {
  console.log('='.repeat(80));
  console.log('CHECKING CRON JOB STATUS VIA SQL RPC');
  console.log('='.repeat(80));
  console.log();

  // Try to call exec_sql function if it exists
  const queries = [
    {
      name: 'Check scheduled cron job',
      sql: `
        SELECT
          jobid,
          schedule,
          active,
          jobname,
          database,
          username
        FROM cron.job
        WHERE jobname = 'daily-kpi-metrics-sync';
      `
    },
    {
      name: 'Check all cron jobs',
      sql: `
        SELECT
          jobid,
          schedule,
          active,
          jobname,
          database
        FROM cron.job
        ORDER BY jobid;
      `
    },
    {
      name: 'Check recent cron job executions',
      sql: `
        SELECT
          run.jobid,
          run.runid,
          run.status,
          run.return_message,
          run.start_time,
          run.end_time
        FROM cron.job_run_details run
        JOIN cron.job j ON j.jobid = run.jobid
        WHERE j.jobname = 'daily-kpi-metrics-sync'
        ORDER BY run.start_time DESC
        LIMIT 20;
      `
    },
    {
      name: 'Check extensions',
      sql: `
        SELECT
          extname,
          extversion
        FROM pg_extension
        WHERE extname IN ('pg_cron', 'pg_net');
      `
    }
  ];

  for (const query of queries) {
    console.log(`${query.name}...`);
    console.log('-'.repeat(80));

    try {
      // Try using exec_sql RPC function
      const { data, error } = await supabase.rpc('exec_sql', {
        query_text: query.sql
      });

      if (error) {
        console.log(`❌ Error: ${error.message}`);

        // If exec_sql doesn't exist, try direct SQL execution
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.log('   Trying alternative method...');

          // For checking cron.job, we can try a different approach
          if (query.name.includes('scheduled cron job')) {
            const { data: viewData, error: viewError } = await supabase
              .from('cron.job')
              .select('*')
              .eq('jobname', 'daily-kpi-metrics-sync');

            if (viewError) {
              console.log(`   Alternative method also failed: ${viewError.message}`);
            } else {
              console.log(`   ✅ Found data via alternative method:`);
              console.log(JSON.stringify(viewData, null, 2));
            }
          }
        }
      } else {
        console.log('✅ Success:');
        console.log(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.log(`❌ Exception: ${err}`);
    }

    console.log();
  }

  console.log('='.repeat(80));
  console.log('Check complete');
  console.log('='.repeat(80));
}

checkCronJobStatus().catch(console.error);
