import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const jobId = process.argv[2];

async function checkStatus() {
  if (!jobId) {
    // Get latest job
    const { data: latestJob } = await supabase
      .from('polling_job_status')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestJob) {
      console.log('📊 Latest Job Status:\n');
      printJobStatus(latestJob);
    } else {
      console.log('❌ No jobs found in polling_job_status table');
    }
    return;
  }

  console.log(`🔍 Checking job status: ${jobId}\n`);

  const { data: job, error } = await supabase
    .from('polling_job_status')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error fetching job:', error);
    return;
  }

  if (!job) {
    console.log('❌ Job not found');
    return;
  }

  printJobStatus(job);

  // Poll until complete
  if (job.status === 'running') {
    console.log('\n⏳ Job still running... checking again in 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await checkStatus();
  }
}

function printJobStatus(job: any) {
  console.log(`Job ID: ${job.id}`);
  console.log(`Status: ${job.status}`);
  console.log(`Started: ${job.started_at}`);
  console.log(`Completed: ${job.completed_at || 'Not yet'}`);

  if (job.total_workspaces) {
    console.log(`\nProgress:`);
    console.log(`  Workspaces: ${job.workspaces_processed}/${job.total_workspaces}`);
    console.log(`  Skipped: ${job.workspaces_skipped}`);
    console.log(`  Accounts synced: ${job.total_accounts_synced}`);
  }

  if (job.duration_ms) {
    console.log(`  Duration: ${(job.duration_ms / 1000).toFixed(1)}s`);
  }

  if (job.error_message) {
    console.log(`\n❌ Error: ${job.error_message}`);
  }

  if (job.warnings && job.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    job.warnings.forEach((w: string) => console.log(`  - ${w}`));
  }
}

checkStatus().catch(console.error);
