const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixCron() {
  console.log('=== CHECKING CRON JOB STATUS ===\n');

  // Try to check cron job status using the helper function
  try {
    const { data: cronStatus, error: cronError } = await supabase.rpc('get_email_cache_cron_status');

    if (cronError) {
      console.log('⚠️  Could not get cron status (may need service role key)');
      console.log('Error:', cronError.message);
    } else if (cronStatus && cronStatus.length > 0) {
      console.log('✅ Cron job found:');
      cronStatus.forEach(job => {
        console.log(`  Job ID: ${job.job_id}`);
        console.log(`  Name: ${job.job_name}`);
        console.log(`  Schedule: ${job.schedule}`);
        console.log(`  Active: ${job.active}`);
        console.log(`  Last Run: ${job.last_run || 'Never'}`);
        console.log(`  Next Run: ${job.next_run || 'Unknown'}`);
      });
    } else {
      console.log('❌ No cron job found - needs to be created');
    }
  } catch (err) {
    console.log('⚠️  Error checking cron:', err.message);
  }

  console.log('\n=== TRIGGERING MANUAL SYNC ===\n');

  // Try using the helper function first
  try {
    console.log('Attempting to trigger via trigger_email_cache_sync() function...');
    const { data, error } = await supabase.rpc('trigger_email_cache_sync');

    if (error) {
      console.log('❌ Helper function failed:', error.message);
      console.log('Trying direct Edge Function call...\n');

      // Fallback to direct Edge Function call
      const { data: directData, error: directError } = await supabase.functions.invoke('poll-sender-emails', {
        body: { force: true }
      });

      if (directError) {
        console.error('❌ Direct call also failed:', directError);
      } else {
        console.log('✅ Sync triggered successfully via direct call!');
        console.log('Response:', directData);
      }
    } else {
      console.log('✅ Sync triggered successfully via helper function!');
      console.log('Response:', data);
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  console.log('\n=== RECOMMENDATIONS ===\n');
  console.log('1. The cron job should run automatically every 30 minutes');
  console.log('2. Check Supabase logs to see if cron is executing');
  console.log('3. If cron is not working, you may need to:');
  console.log('   - Enable pg_cron extension in Supabase dashboard');
  console.log('   - Run the migration: supabase/migrations/20251010000001_setup_email_cache_cron.sql');
  console.log('   - Or set up external cron (GitHub Actions, etc.)');
}

checkAndFixCron();
