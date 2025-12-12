const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function executeFullSync() {
  console.log('🚀 EXECUTING FULL EMAIL SYNC WITH SERVICE ROLE PERMISSIONS\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Step 1: Check current status
  console.log('Step 1: Checking current data status...');
  const { data: currentData, error: currentError } = await supabase
    .from('sender_emails_cache')
    .select('last_synced_at')
    .order('last_synced_at', { ascending: false })
    .limit(1);

  if (currentError) {
    console.error('❌ Error:', currentError.message);
    return;
  }

  if (currentData && currentData.length > 0) {
    const lastSync = new Date(currentData[0].last_synced_at);
    const hoursOld = (Date.now() - lastSync.getTime()) / 1000 / 60 / 60;
    console.log(`✅ Current last sync: ${lastSync.toISOString()}`);
    console.log(`   Age: ${hoursOld.toFixed(1)} hours (${(hoursOld/24).toFixed(1)} days)\n`);
  }

  // Step 2: Trigger the sync with service role key
  console.log('Step 2: Triggering hybrid-email-accounts-v2 Edge Function...');
  console.log('   Using SERVICE ROLE KEY for full permissions');
  console.log('   Processing all 5000+ accounts from Email Bison API\n');

  try {
    const { data: syncData, error: syncError } = await supabase.functions.invoke('hybrid-email-accounts-v2', {
      body: {
        manual_trigger: true,
        force_refresh: true
      }
    });

    if (syncError) {
      console.error('❌ Sync failed:', syncError);
      console.log('\nTrying alternative approach...\n');

      // Alternative: Try calling the sync-email-accounts-cache function
      const { data: altData, error: altError } = await supabase.functions.invoke('sync-email-accounts-cache', {
        body: { manual: true }
      });

      if (altError) {
        console.error('❌ Alternative sync also failed:', altError.message);
        return;
      }

      console.log('✅ Alternative sync triggered!');
      console.log('Response:', JSON.stringify(altData, null, 2));
    } else {
      console.log('✅ Sync triggered successfully!');
      console.log('Response:', JSON.stringify(syncData, null, 2));
    }

    console.log('\n⏳ Waiting 3 minutes for sync to complete...');
    console.log('   (Processing 5000+ email accounts)\n');

    // Wait 3 minutes
    await new Promise(resolve => setTimeout(resolve, 180000));

    // Step 3: Verify sync completed
    console.log('Step 3: Verifying sync completion...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('sender_emails_cache')
      .select('last_synced_at, email_address')
      .order('last_synced_at', { ascending: false })
      .limit(10);

    if (verifyError) {
      console.error('❌ Verification error:', verifyError.message);
      return;
    }

    if (verifyData && verifyData.length > 0) {
      const newSync = new Date(verifyData[0].last_synced_at);
      const minutesOld = (Date.now() - newSync.getTime()) / 1000 / 60;

      console.log(`\n✅ Latest sync time: ${newSync.toISOString()}`);
      console.log(`   Age: ${minutesOld.toFixed(1)} minutes\n`);

      console.log('Sample of recently synced accounts:');
      verifyData.slice(0, 5).forEach((acc, i) => {
        const syncDate = new Date(acc.last_synced_at);
        const mins = (Date.now() - syncDate.getTime()) / 1000 / 60;
        console.log(`   ${i+1}. ${acc.email_address} - ${mins.toFixed(1)} minutes ago`);
      });

      if (minutesOld < 10) {
        console.log('\n════════════════════════════════════════════════════════════');
        console.log('🎉 SUCCESS! EMAIL SYNC COMPLETED!');
        console.log('════════════════════════════════════════════════════════════\n');
        console.log('✅ Data is now fresh and up-to-date\n');
        console.log('📋 NEXT STEPS:\n');
        console.log('1. Go to: https://www.maverickmarketingllc.com/email-accounts');
        console.log('2. Hard refresh your browser:');
        console.log('   - Mac: Cmd + Shift + R');
        console.log('   - Windows: Ctrl + Shift + R');
        console.log('3. Check that:');
        console.log('   ✅ "Last synced" shows recent time');
        console.log('   ✅ "Burnt Mailboxes" alert appears');
        console.log('   ✅ All data is current\n');
        console.log('════════════════════════════════════════════════════════════\n');
      } else {
        console.log('\n⚠️  Data is still old (${minutesOld.toFixed(1)} minutes)');
        console.log('   Sync may still be processing or may have failed.');
        console.log('   Wait 2 more minutes and check the database again.\n');
      }
    }

  } catch (err) {
    console.error('❌ Exception:', err.message);
    console.error('Stack:', err.stack);
  }
}

executeFullSync().catch(console.error);
