import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseWorkspaceIssue() {
  console.log('=== DIAGNOSIS: Workspark vs Radiant Energy Workspace Mapping ===\n');

  // 1. Check client_registry configuration
  console.log('1. Client Registry Configuration:');
  const { data: registry } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
    .in('workspace_name', ['Workspark', 'Radiant Energy']);

  registry?.forEach(r => {
    console.log(`   ${r.workspace_name}:`);
    console.log(`     - Bison Workspace ID: ${r.bison_workspace_id}`);
    console.log(`     - Instance: ${r.bison_instance}`);
    console.log(`     - Has Custom Key: ${!!r.bison_api_key ? 'YES (workspace-scoped)' : 'NO (uses global key + workspace switch)'}`);
  });

  // 2. Check what's in the cache
  console.log('\n2. What\'s Currently in sender_emails_cache:');
  const { data: cache } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, bison_workspace_id, email_address, account_name, domain')
    .in('workspace_name', ['Workspark', 'Radiant Energy']);

  const workspark = cache?.filter(a => a.workspace_name === 'Workspark') || [];
  const radiant = cache?.filter(a => a.workspace_name === 'Radiant Energy') || [];

  console.log(`   Workspark (${workspark.length} accounts):`);
  console.log(`     - Bison Workspace ID in cache: ${workspark[0]?.bison_workspace_id}`);
  console.log(`     - Domains: ${[...new Set(workspark.map(a => a.domain))].slice(0, 3).join(', ')}...`);
  console.log(`     - Sample emails: ${workspark.slice(0, 2).map(a => a.email_address).join(', ')}`);

  console.log(`\n   Radiant Energy (${radiant.length} accounts):`);
  console.log(`     - Bison Workspace ID in cache: ${radiant[0]?.bison_workspace_id}`);
  console.log(`     - Domains: ${[...new Set(radiant.map(a => a.domain))].slice(0, 3).join(', ')}...`);
  console.log(`     - Sample emails: ${radiant.slice(0, 2).map(a => a.email_address).join(', ')}`);

  // 3. Analysis
  console.log('\n3. ISSUE ANALYSIS:');

  const worksparkDomains = [...new Set(workspark.map(a => a.domain))];
  const hasEmpowerWorkspark = worksparkDomains.some(d => d?.includes('empowerworkspark'));
  const hasRadiantDomains = worksparkDomains.some(d => d?.includes('radiantenergy'));

  if (hasRadiantDomains && !hasEmpowerWorkspark) {
    console.log('   ❌ PROBLEM CONFIRMED: Workspark cache contains radiantenergy domains');
    console.log('   ❌ Workspark cache is MISSING empowerworkspark.com domains');
    console.log('\n   ROOT CAUSE:');
    console.log('   The polling job is fetching accounts from the WRONG Bison workspace for Workspark');
    console.log('\n   POSSIBLE REASONS:');
    console.log('   A. Bison Workspace ID 14 in client_registry is incorrect for Workspark');
    console.log('   B. Workspace switch API call is failing/being ignored');
    console.log('   C. Parallel processing is causing workspace switch conflicts');
    console.log('   D. The global Long Run API key doesn\'t have access to workspace 14');
  } else if (hasEmpowerWorkspark) {
    console.log('   ✓ Workspark cache looks correct (has empowerworkspark.com)');
  }

  console.log('\n4. RECOMMENDED FIXES:');
  console.log('   Option A: Give Workspark a workspace-specific API key (like Radiant Energy has)');
  console.log('   Option B: Verify the correct Bison Workspace ID for Workspark in Long Run');
  console.log('   Option C: Process Workspark and Radiant sequentially (not parallel) to avoid switch conflicts');

  console.log('\n5. NEXT STEPS:');
  console.log('   1. Log into Long Run Bison (send.longrun.agency)');
  console.log('   2. Find the workspace containing lesley.redman@empowerworkspark.com');
  console.log('   3. Note the workspace ID from the URL or settings');
  console.log('   4. Compare it to the workspace ID in client_registry (currently: 14)');
  console.log('   5. Update client_registry if different, OR create workspace-specific API key');
}

diagnoseWorkspaceIssue().catch(console.error);
