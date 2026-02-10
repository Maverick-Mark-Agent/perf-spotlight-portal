import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function investigate() {
  console.log('🔍 Investigating account count discrepancy...\n');

  // Check 1: Get total count
  console.log('Check 1: Getting total count from sender_emails_cache...');
  const { count: totalCount, error: countError } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error getting count:', countError);
    return;
  }

  console.log(`✅ Total accounts in database: ${totalCount}\n`);

  // Check 2: Try fetching with explicit limit
  console.log('Check 2: Fetching with explicit limit of 10000...');
  const { data: accounts10k, error: error10k } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .order('last_synced_at', { ascending: false })
    .limit(10000);

  if (error10k) {
    console.error('❌ Error fetching with limit 10000:', error10k);
  } else {
    console.log(`✅ Fetched ${accounts10k?.length || 0} accounts with limit 10000\n`);
  }

  // Check 3: Try fetching with dynamic limit based on count
  console.log(`Check 3: Fetching with dynamic limit of ${totalCount}...`);
  const { data: accountsDynamic, error: errorDynamic } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .order('last_synced_at', { ascending: false })
    .limit(totalCount || 10000);

  if (errorDynamic) {
    console.error('❌ Error fetching with dynamic limit:', errorDynamic);
  } else {
    console.log(`✅ Fetched ${accountsDynamic?.length || 0} accounts with dynamic limit\n`);
  }

  // Check 4: Check active workspaces
  console.log('Check 4: Checking active workspaces in client_registry...');
  const { data: workspaces, error: workspacesError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_instance, is_active')
    .eq('is_active', true);

  if (workspacesError) {
    console.error('❌ Error fetching workspaces:', workspacesError);
  } else {
    console.log(`✅ Found ${workspaces?.length || 0} active workspaces:\n`);
    workspaces?.forEach(w => {
      console.log(`   - ${w.workspace_name} (${w.bison_instance})`);
    });
  }

  // Check 5: Accounts per workspace
  console.log('\nCheck 5: Accounts per workspace in sender_emails_cache...');
  const { data: workspaceStats, error: statsError } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name')
    .order('workspace_name');

  if (statsError) {
    console.error('❌ Error fetching workspace stats:', statsError);
  } else {
    const workspaceCounts: Record<string, number> = {};
    workspaceStats?.forEach(row => {
      workspaceCounts[row.workspace_name] = (workspaceCounts[row.workspace_name] || 0) + 1;
    });

    console.log(`✅ Accounts per workspace:`);
    Object.entries(workspaceCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([workspace, count]) => {
        console.log(`   - ${workspace}: ${count} accounts`);
      });
  }

  // Check 6: Check latest polling job status
  console.log('\nCheck 6: Checking latest polling job status...');
  const { data: jobStatus, error: jobError } = await supabase
    .from('polling_job_status')
    .select('*')
    .eq('job_name', 'poll-sender-emails')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobError) {
    console.error('❌ Error fetching job status:', jobError);
  } else if (jobStatus) {
    console.log('✅ Latest polling job:');
    console.log(`   - Status: ${jobStatus.status}`);
    console.log(`   - Started: ${jobStatus.started_at}`);
    console.log(`   - Completed: ${jobStatus.completed_at}`);
    console.log(`   - Workspaces: ${jobStatus.workspaces_processed}/${jobStatus.total_workspaces}`);
    console.log(`   - Accounts synced: ${jobStatus.total_accounts_synced}`);
    console.log(`   - Duration: ${jobStatus.duration_ms}ms`);
    if (jobStatus.warnings && jobStatus.warnings.length > 0) {
      console.log(`   - Warnings: ${jobStatus.warnings.join(', ')}`);
    }
  } else {
    console.log('⚠️  No polling job status found - table may not exist or job hasn\'t run yet');
  }

  console.log('\n📊 Summary:');
  console.log(`   Database has: ${totalCount} accounts`);
  console.log(`   Frontend fetched: ${accountsDynamic?.length || 0} accounts`);
  if (totalCount !== (accountsDynamic?.length || 0)) {
    console.log(`   ❌ DISCREPANCY: Missing ${totalCount - (accountsDynamic?.length || 0)} accounts!`);
  } else {
    console.log(`   ✅ All accounts fetched successfully`);
  }
}

investigate().catch(console.error);
