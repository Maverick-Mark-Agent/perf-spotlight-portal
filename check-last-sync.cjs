const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastSync() {
  console.log('Checking last sync time from sender_emails_cache...\n');

  // Get the most recent sync time
  const { data, error } = await supabase
    .from('sender_emails_cache')
    .select('last_synced_at')
    .not('last_synced_at', 'is', null)
    .order('last_synced_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No sync data found');
    return;
  }

  const lastSync = new Date(data[0].last_synced_at);
  const now = new Date();
  const ageMs = now - lastSync;
  const ageHours = ageMs / 1000 / 60 / 60;
  const ageDays = ageHours / 24;

  console.log('=== SYNC STATUS ===');
  console.log(`Last Sync Time: ${lastSync.toISOString()}`);
  console.log(`Current Time:   ${now.toISOString()}`);
  console.log(`Age: ${ageHours.toFixed(1)} hours (${ageDays.toFixed(1)} days)`);
  console.log('');

  if (ageHours > 24) {
    console.log('⚠️  WARNING: Data is more than 24 hours old!');
    console.log('The sync job may have failed or been disabled.');
  } else {
    console.log('✅ Data is fresh (less than 24 hours old)');
  }

  // Check for your specific login
  console.log('\n=== CHECKING USER-SPECIFIC DATA ===');
  const { data: userAccounts } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, last_synced_at')
    .ilike('workspace_name', '%hussain%')
    .limit(5);

  if (userAccounts && userAccounts.length > 0) {
    console.log('Accounts for workspaces containing "hussain":');
    userAccounts.forEach(acc => {
      const syncTime = new Date(acc.last_synced_at);
      const hours = (now - syncTime) / 1000 / 60 / 60;
      console.log(`  ${acc.workspace_name}: ${syncTime.toISOString()} (${hours.toFixed(1)}h ago)`);
    });
  } else {
    console.log('No accounts found for hussain workspace');
  }
}

checkLastSync().catch(console.error);
