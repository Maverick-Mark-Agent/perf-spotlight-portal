const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSQLScripts() {
  console.log('🚀 Running SQL scripts to fix email sync...\n');

  try {
    // Step 1: Check current status
    console.log('Step 1: Checking current sync status...');
    const { data: statusData, error: statusError } = await supabase
      .from('sender_emails_cache')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1);

    if (statusError) {
      console.error('❌ Error checking status:', statusError.message);
    } else if (statusData && statusData.length > 0) {
      const lastSync = new Date(statusData[0].last_synced_at);
      const hoursOld = (Date.now() - lastSync.getTime()) / 1000 / 60 / 60;
      console.log(`   Last sync: ${lastSync.toISOString()}`);
      console.log(`   Age: ${hoursOld.toFixed(1)} hours (${(hoursOld/24).toFixed(1)} days)\n`);
    }

    // Step 2: Try to trigger sync using RPC
    console.log('Step 2: Triggering email sync...');
    console.log('   Attempting to call hybrid-email-accounts-v2 Edge Function...\n');

    const { data: syncData, error: syncError } = await supabase.functions.invoke('hybrid-email-accounts-v2', {
      body: { manual_trigger: true }
    });

    if (syncError) {
      console.log('⚠️  Direct Edge Function call requires service role key.');
      console.log('   Error:', syncError.message);
      console.log('\n📋 MANUAL STEPS REQUIRED:\n');
      printManualInstructions();
      return;
    }

    console.log('✅ Sync triggered successfully!');
    console.log('   Response:', JSON.stringify(syncData, null, 2));
    console.log('\n⏳ Waiting 3 minutes for sync to complete...');

    // Wait 3 minutes
    await sleep(180000);

    // Step 3: Verify sync completed
    console.log('\nStep 3: Verifying sync completed...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('sender_emails_cache')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1);

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError.message);
    } else if (verifyData && verifyData.length > 0) {
      const newSync = new Date(verifyData[0].last_synced_at);
      const minutesOld = (Date.now() - newSync.getTime()) / 1000 / 60;

      console.log(`   Latest sync: ${newSync.toISOString()}`);
      console.log(`   Age: ${minutesOld.toFixed(1)} minutes\n`);

      if (minutesOld < 10) {
        console.log('🎉 SUCCESS! Data has been synced!\n');
        console.log('Next steps:');
        console.log('1. Hard refresh your browser (Cmd+Shift+R)');
        console.log('2. Go to: https://www.maverickmarketingllc.com/email-accounts');
        console.log('3. Check that timestamp shows recent time');
        console.log('4. Look for burnt mailbox alert\n');
      } else {
        console.log('⚠️  Data is still old. Sync may have failed.');
        console.log('   Please follow manual steps below.\n');
        printManualInstructions();
      }
    }

  } catch (err) {
    console.error('❌ Exception:', err.message);
    console.log('\n📋 MANUAL STEPS REQUIRED:\n');
    printManualInstructions();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printManualInstructions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('MANUAL SETUP REQUIRED');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('The automated script cannot complete due to permission restrictions.');
  console.log('You need to run the SQL scripts manually in Supabase.\n');

  console.log('📝 COPY & PASTE THESE STEPS:\n');

  console.log('1. Open Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new\n');

  console.log('2. Open the file: DEPLOY_EMAIL_SYNC_FIX.md');
  console.log('   (Located in the project root directory)\n');

  console.log('3. Follow the step-by-step instructions in that file');
  console.log('   (It has 3 simple SQL scripts to copy & paste)\n');

  console.log('4. Total time: ~5 minutes\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

runSQLScripts();
