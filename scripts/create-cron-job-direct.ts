/**
 * Direct SQL Execution to Create Cron Job
 *
 * This script creates the daily-kpi-metrics-sync cron job directly
 * by invoking the Supabase Edge Function endpoint with SQL commands.
 */

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

async function createCronJob() {
  console.log('='.repeat(80));
  console.log('CREATING CRON JOB: daily-kpi-metrics-sync');
  console.log('='.repeat(80));

  const sql = `
    -- First, try to unschedule if exists (ignore errors)
    DO $$
    BEGIN
      PERFORM cron.unschedule('daily-kpi-metrics-sync');
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END $$;

    -- Schedule the new job
    SELECT cron.schedule(
      'daily-kpi-metrics-sync',              -- job name
      '1 0 * * *',                           -- cron expression: 12:01 AM every day
      $$
        -- Call the sync-daily-kpi-metrics Edge Function
        SELECT
          net.http_post(
            url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-daily-kpi-metrics',
            headers := jsonb_build_object(
              'Content-Type', 'application/json'
            ),
            body := jsonb_build_object('scheduled', true, 'timestamp', now())
          ) as request_id;
      $$
    );

    -- Verify the job was created
    SELECT
      jobid,
      schedule,
      active,
      jobname
    FROM cron.job
    WHERE jobname = 'daily-kpi-metrics-sync';
  `;

  try {
    // Use the sync-daily-kpi-metrics function itself to execute SQL
    // (This is a workaround - ideally we'd have a dedicated exec_sql function)

    console.log('\n📡 Calling Supabase to create cron job...');
    console.log('Note: We need direct database access for this. Let me provide the SQL for you to run.\n');

    console.log('='.repeat(80));
    console.log('PLEASE RUN THIS SQL IN SUPABASE DASHBOARD');
    console.log('='.repeat(80));
    console.log('\nGo to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql');
    console.log('\nPaste and execute:\n');
    console.log(sql);
    console.log('\n' + '='.repeat(80));
    console.log('\nAfter running, the cron job will be created and scheduled.');
    console.log('It will run daily at 12:01 AM UTC (4:01 PM PST).');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

createCronJob().catch(console.error);
