const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserData() {
  console.log('Checking if data is user-specific or global...\n');

  // Check 1: Get total count
  const { count: totalCount, error: countError } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error getting count:', countError);
    return;
  }

  console.log(`Total accounts in database: ${totalCount}`);

  // Check 2: Get sample of last_synced_at timestamps
  const { data: samples, error: sampleError } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name, last_synced_at')
    .order('last_synced_at', { ascending: false })
    .limit(10);

  if (sampleError) {
    console.error('Error getting samples:', sampleError);
    return;
  }

  console.log('\nMost recently synced accounts:');
  samples.forEach((acc, i) => {
    const syncDate = new Date(acc.last_synced_at);
    const hoursOld = (Date.now() - syncDate.getTime()) / 1000 / 60 / 60;
    console.log(`${i + 1}. ${acc.email_address} (${acc.workspace_name})`);
    console.log(`   Synced: ${syncDate.toISOString()} (${hoursOld.toFixed(1)}h ago)`);
  });

  // Check 3: Get unique sync times
  const { data: uniqueSyncs } = await supabase
    .from('sender_emails_cache')
    .select('last_synced_at')
    .order('last_synced_at', { ascending: false })
    .limit(100);

  if (uniqueSyncs) {
    const uniqueTimes = new Set(uniqueSyncs.map(s => s.last_synced_at));
    console.log(`\nUnique sync timestamps: ${uniqueTimes.size}`);
    console.log('This shows if data was synced in batches or all at once.\n');
  }

  // Check 4: Check for workspace-specific data
  const { data: workspaceGroups } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, last_synced_at')
    .order('workspace_name');

  if (workspaceGroups) {
    const workspaceSync = {};
    workspaceGroups.forEach(acc => {
      if (!workspaceSync[acc.workspace_name]) {
        workspaceSync[acc.workspace_name] = new Set();
      }
      workspaceSync[acc.workspace_name].add(acc.last_synced_at);
    });

    console.log('Workspaces with different sync times:');
    Object.entries(workspaceSync).forEach(([workspace, times]) => {
      if (times.size > 1) {
        console.log(`  ${workspace}: ${times.size} different sync times`);
      }
    });
  }

  console.log('\n=== CONCLUSION ===');
  console.log('If all accounts have the same old timestamp (Oct 26):');
  console.log('  → Data is truly stale for EVERYONE');
  console.log('  → Your colleague may be seeing cached JavaScript');
  console.log('');
  console.log('If some accounts have recent timestamps:');
  console.log('  → Partial sync occurred');
  console.log('  → Need to sync remaining workspaces');
}

checkUserData();
