import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Missing Supabase key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateSyncDailyKPI() {
  console.log('='.repeat(80));
  console.log('INVESTIGATING sync-daily-kpi-metrics Edge Function');
  console.log('='.repeat(80));
  console.log();

  // 1. Check pg_cron_log table for last execution
  console.log('1. Checking pg_cron_log for sync-daily-kpi-metrics execution history...');
  console.log('-'.repeat(80));
  try {
    const { data: cronLogs, error: cronLogError } = await supabase
      .from('pg_cron_log')
      .select('*')
      .or('command.ilike.%sync-daily-kpi%,jobname.ilike.%sync-daily-kpi%')
      .order('start_time', { ascending: false })
      .limit(20);

    if (cronLogError) {
      console.log(`Error querying pg_cron_log: ${cronLogError.message}`);
      console.log('Table may not exist or insufficient permissions');
    } else if (cronLogs && cronLogs.length > 0) {
      console.log(`Found ${cronLogs.length} cron log entries:`);
      cronLogs.forEach((log, idx) => {
        console.log(`\n  Entry ${idx + 1}:`);
        console.log(`    Job ID: ${log.jobid}`);
        console.log(`    Job Name: ${log.jobname}`);
        console.log(`    Command: ${log.command}`);
        console.log(`    Start Time: ${log.start_time}`);
        console.log(`    End Time: ${log.end_time}`);
        console.log(`    Status: ${log.status}`);
        console.log(`    Return Message: ${log.return_message}`);
      });
    } else {
      console.log('No cron log entries found for sync-daily-kpi-metrics');
    }
  } catch (err) {
    console.log(`Exception checking pg_cron_log: ${err}`);
  }
  console.log();

  // 2. Check pg_cron.job table for scheduled jobs
  console.log('2. Checking pg_cron.job for scheduled cron jobs...');
  console.log('-'.repeat(80));
  try {
    const { data: cronJobs, error: cronJobError } = await supabase
      .from('pg_cron.job')
      .select('*')
      .or('command.ilike.%sync-daily-kpi%,jobname.ilike.%sync-daily-kpi%');

    if (cronJobError) {
      console.log(`Error querying pg_cron.job: ${cronJobError.message}`);
      console.log('Table may not exist or insufficient permissions');
    } else if (cronJobs && cronJobs.length > 0) {
      console.log(`Found ${cronJobs.length} scheduled cron job(s):`);
      cronJobs.forEach((job, idx) => {
        console.log(`\n  Job ${idx + 1}:`);
        console.log(`    Job ID: ${job.jobid}`);
        console.log(`    Job Name: ${job.jobname}`);
        console.log(`    Schedule: ${job.schedule}`);
        console.log(`    Command: ${job.command}`);
        console.log(`    Active: ${job.active}`);
        console.log(`    Database: ${job.database}`);
      });
    } else {
      console.log('No scheduled cron jobs found for sync-daily-kpi-metrics');
    }
  } catch (err) {
    console.log(`Exception checking pg_cron.job: ${err}`);
  }
  console.log();

  // 3. Check webhook_delivery_log for recent webhook activity
  console.log('3. Checking webhook_delivery_log for recent webhook deliveries...');
  console.log('-'.repeat(80));
  try {
    const { data: webhookLogs, error: webhookError } = await supabase
      .from('webhook_delivery_log')
      .select('*')
      .order('delivered_at', { ascending: false })
      .limit(10);

    if (webhookError) {
      console.log(`Error querying webhook_delivery_log: ${webhookError.message}`);
    } else if (webhookLogs && webhookLogs.length > 0) {
      console.log(`Found ${webhookLogs.length} recent webhook deliveries:`);
      webhookLogs.forEach((log, idx) => {
        console.log(`\n  Webhook ${idx + 1}:`);
        console.log(`    ID: ${log.id}`);
        console.log(`    Delivered At: ${log.delivered_at}`);
        console.log(`    Status: ${log.status}`);
        console.log(`    Event Type: ${log.event_type}`);
        console.log(`    Workspace ID: ${log.workspace_id}`);
      });
    } else {
      console.log('No webhook delivery logs found');
    }
  } catch (err) {
    console.log(`Exception checking webhook_delivery_log: ${err}`);
  }
  console.log();

  // 4. Check daily_kpi_metrics table for recent entries
  console.log('4. Checking daily_kpi_metrics table for recent entries...');
  console.log('-'.repeat(80));
  try {
    const { data: kpiMetrics, error: kpiError } = await supabase
      .from('daily_kpi_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(10);

    if (kpiError) {
      console.log(`Error querying daily_kpi_metrics: ${kpiError.message}`);
    } else if (kpiMetrics && kpiMetrics.length > 0) {
      console.log(`Found ${kpiMetrics.length} recent KPI metric entries:`);
      kpiMetrics.forEach((metric, idx) => {
        console.log(`\n  Entry ${idx + 1}:`);
        console.log(`    Date: ${metric.date}`);
        console.log(`    Created At: ${metric.created_at}`);
        console.log(`    Total Contacts: ${metric.total_contacts}`);
        console.log(`    Total Revenue: ${metric.total_revenue}`);
      });
    } else {
      console.log('No KPI metrics found');
    }
  } catch (err) {
    console.log(`Exception checking daily_kpi_metrics: ${err}`);
  }
  console.log();

  // 5. Try to query cron.job_run_details if it exists
  console.log('5. Checking cron.job_run_details for execution details...');
  console.log('-'.repeat(80));
  try {
    const { data: jobRuns, error: jobRunError } = await supabase
      .from('cron.job_run_details')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(10);

    if (jobRunError) {
      console.log(`Error querying cron.job_run_details: ${jobRunError.message}`);
      console.log('Table may not exist');
    } else if (jobRuns && jobRuns.length > 0) {
      console.log(`Found ${jobRuns.length} recent job runs:`);
      jobRuns.forEach((run, idx) => {
        console.log(`\n  Run ${idx + 1}:`);
        console.log(`    Job ID: ${run.jobid}`);
        console.log(`    Run ID: ${run.runid}`);
        console.log(`    Start Time: ${run.start_time}`);
        console.log(`    End Time: ${run.end_time}`);
        console.log(`    Status: ${run.status}`);
      });
    } else {
      console.log('No job run details found');
    }
  } catch (err) {
    console.log(`Exception checking cron.job_run_details: ${err}`);
  }
  console.log();

  console.log('='.repeat(80));
  console.log('Investigation complete');
  console.log('='.repeat(80));
}

investigateSyncDailyKPI().catch(console.error);
