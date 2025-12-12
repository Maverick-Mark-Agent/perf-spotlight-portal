const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAndSync() {
  console.log('🚀 Setting up automatic email sync system...\n');

  // Step 1: Try to trigger the hybrid email accounts function directly
  console.log('Step 1: Triggering hybrid-email-accounts-v2 function...');

  try {
    const { data, error } = await supabase.functions.invoke('hybrid-email-accounts-v2', {
      body: {}
    });

    if (error) {
      console.error('❌ Error invoking hybrid-email-accounts-v2:', error.message);
      console.log('\n⚠️  The function may require service role key or may not exist.');
      console.log('\nPlease follow the MANUAL STEPS below:\n');
      printManualSteps();
      return;
    }

    console.log('✅ Function invoked successfully!');
    console.log('Response:', JSON.stringify(data, null, 2));

    console.log('\n⏳ Waiting 30 seconds for data to sync...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Check if data was updated
    console.log('\nStep 2: Checking if data was updated...');
    const { data: cacheData, error: cacheError } = await supabase
      .from('sender_emails_cache')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1);

    if (cacheError) {
      console.error('❌ Error checking cache:', cacheError.message);
    } else if (cacheData && cacheData.length > 0) {
      const lastSync = new Date(cacheData[0].last_synced_at);
      const ageMinutes = (Date.now() - lastSync.getTime()) / 1000 / 60;

      console.log(`\n✅ Last sync: ${lastSync.toISOString()}`);
      console.log(`   Age: ${ageMinutes.toFixed(1)} minutes`);

      if (ageMinutes < 5) {
        console.log('\n🎉 SUCCESS! Data has been synced!');
        console.log('\nNext steps:');
        console.log('1. Hard refresh your browser (Cmd+Shift+R)');
        console.log('2. Go to: https://www.maverickmarketingllc.com/email-accounts');
        console.log('3. Check that timestamp shows "Last synced: A few minutes ago"');
        console.log('4. Look for the burnt mailbox alert in Action Items & Alerts');
      } else {
        console.log('\n⚠️  Data is still old. The sync may have failed or is still processing.');
        console.log('   Please wait another 2-3 minutes and check again.');
      }
    }

  } catch (err) {
    console.error('❌ Exception:', err.message);
    console.log('\n⚠️  Could not complete automatic setup.');
    console.log('\nPlease follow the MANUAL STEPS below:\n');
    printManualSteps();
  }
}

function printManualSteps() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('MANUAL SETUP STEPS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('1. Open Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new\n');

  console.log('2. Copy the contents of: manual-sync-fix.sql');
  console.log('   (Created in the project root directory)\n');

  console.log('3. Paste into SQL Editor and click "RUN"\n');

  console.log('4. After setup completes, uncomment the last line:');
  console.log('   SELECT public.manual_trigger_email_sync();\n');

  console.log('5. Run that line to trigger immediate sync\n');

  console.log('6. Wait 2-5 minutes for sync to complete\n');

  console.log('7. Refresh your dashboard with Cmd+Shift+R\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

setupAndSync();
