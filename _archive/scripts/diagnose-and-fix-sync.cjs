const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function diagnoseAndFix() {
  console.log('🔍 DIAGNOSING EMAIL SYNC ISSUE...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Step 1: Check current data status
  console.log('Step 1: Checking current data status...');
  const { data: currentData, error: currentError } = await supabase
    .from('sender_emails_cache')
    .select('last_synced_at, email_address')
    .order('last_synced_at', { ascending: false })
    .limit(1);

  if (currentError) {
    console.error('❌ Error:', currentError.message);
    return;
  }

  if (currentData && currentData.length > 0) {
    const lastSync = new Date(currentData[0].last_synced_at);
    const hoursOld = (Date.now() - lastSync.getTime()) / 1000 / 60 / 60;
    console.log(`   Last sync: ${lastSync.toISOString()}`);
    console.log(`   Age: ${hoursOld.toFixed(1)} hours (${(hoursOld/24).toFixed(1)} days)\n`);
  }

  // Step 2: Check if cron jobs exist
  console.log('Step 2: Checking cron job configuration...');
  const { data: cronJobs, error: cronError } = await supabase
    .rpc('exec_sql', {
      query: 'SELECT jobid, jobname, schedule, active, command FROM cron.job WHERE jobname LIKE \'%email%\' OR jobname LIKE \'%sync%\''
    });

  if (cronError) {
    console.log('   ⚠️  Could not query cron jobs (may need service role)\n');
  } else {
    console.log(`   Found ${cronJobs?.length || 0} email-related cron jobs`);
    if (cronJobs && cronJobs.length > 0) {
      cronJobs.forEach(job => {
        console.log(`     - ${job.jobname}: ${job.schedule} (active: ${job.active})`);
      });
    }
    console.log('');
  }

  // Step 3: Try to trigger sync via different Edge Functions
  console.log('Step 3: Attempting to trigger sync...\n');

  const functionsToTry = [
    'hybrid-email-accounts-v2',
    'sync-email-accounts-cache',
    'poll-sender-emails'
  ];

  for (const funcName of functionsToTry) {
    console.log(`   Trying: ${funcName}...`);
    try {
      const { data, error } = await supabase.functions.invoke(funcName, {
        body: { manual: true, force: true }
      });

      if (error) {
        console.log(`   ❌ ${funcName}: ${error.message}`);
      } else {
        console.log(`   ✅ ${funcName}: Triggered successfully`);
        console.log(`      Response:`, JSON.stringify(data).substring(0, 100));

        // If this function succeeded, wait and check if data updated
        console.log(`\n   ⏳ Waiting 3 minutes for ${funcName} to complete...\n`);
        await new Promise(resolve => setTimeout(resolve, 180000));

        // Check if data was updated
        const { data: verifyData } = await supabase
          .from('sender_emails_cache')
          .select('last_synced_at')
          .order('last_synced_at', { ascending: false })
          .limit(1);

        if (verifyData && verifyData.length > 0) {
          const newSync = new Date(verifyData[0].last_synced_at);
          const minutesOld = (Date.now() - newSync.getTime()) / 1000 / 60;

          if (minutesOld < 10) {
            console.log('   ✅ SUCCESS! Data was updated!\n');
            console.log('════════════════════════════════════════════════════════════');
            console.log('🎉 SYNC COMPLETE!');
            console.log('════════════════════════════════════════════════════════════\n');
            console.log(`   New sync time: ${newSync.toISOString()}`);
            console.log(`   Age: ${minutesOld.toFixed(1)} minutes\n`);
            console.log('📋 NEXT STEPS:\n');
            console.log('1. Go to: https://www.maverickmarketingllc.com/email-accounts');
            console.log('2. Hard refresh: Cmd+Shift+R');
            console.log('3. Check for burnt mailbox alert\n');
            return;
          } else {
            console.log(`   ⚠️  Data is still old (${minutesOld.toFixed(1)} minutes)\n`);
          }
        }
      }
    } catch (err) {
      console.log(`   ❌ ${funcName}: Exception - ${err.message}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('⚠️  COULD NOT TRIGGER SYNC AUTOMATICALLY');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log('DIAGNOSIS:');
  console.log('- All Edge Functions either failed or did not update data');
  console.log('- Possible causes:');
  console.log('  1. Edge Functions may require service role key');
  console.log('  2. Cron job may be disabled');
  console.log('  3. Edge Function environment variables may be missing\n');

  console.log('RECOMMENDED ACTION:');
  console.log('Check Edge Function logs at:');
  console.log('https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/logs/edge-functions\n');
  console.log('Look for errors in recent invocations of:');
  console.log('- hybrid-email-accounts-v2');
  console.log('- poll-sender-emails');
  console.log('- sync-email-accounts-cache\n');
}

diagnoseAndFix().catch(console.error);
