import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findMissingWorkspaces() {
  console.log('🔍 Finding workspaces with no synced accounts...\n');

  // Get all active workspaces
  const { data: workspaces, error: workspacesError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_instance, bison_workspace_id, bison_api_key, is_active')
    .eq('is_active', true)
    .order('workspace_name');

  if (workspacesError || !workspaces) {
    console.error('❌ Error fetching workspaces:', workspacesError);
    return;
  }

  console.log(`✅ Found ${workspaces.length} active workspaces\n`);

  // Get accounts per workspace
  const { data: accountWorkspaces, error: accountsError } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name');

  if (accountsError) {
    console.error('❌ Error fetching accounts:', accountsError);
    return;
  }

  const accountCounts: Record<string, number> = {};
  accountWorkspaces?.forEach(row => {
    accountCounts[row.workspace_name] = (accountCounts[row.workspace_name] || 0) + 1;
  });

  console.log('📊 Workspace Analysis:\n');

  const workspacesWithAccounts: string[] = [];
  const workspacesWithoutAccounts: Array<{ name: string; instance: string; hasApiKey: boolean; workspaceId: string | null }> = [];

  workspaces.forEach(workspace => {
    const count = accountCounts[workspace.workspace_name] || 0;
    if (count > 0) {
      workspacesWithAccounts.push(workspace.workspace_name);
      console.log(`✅ ${workspace.workspace_name} (${workspace.bison_instance}): ${count} accounts`);
    } else {
      workspacesWithoutAccounts.push({
        name: workspace.workspace_name,
        instance: workspace.bison_instance,
        hasApiKey: !!workspace.bison_api_key,
        workspaceId: workspace.bison_workspace_id
      });
      console.log(`❌ ${workspace.workspace_name} (${workspace.bison_instance}): 0 accounts - ${workspace.bison_api_key ? 'HAS' : 'NO'} API key, workspace ID: ${workspace.bison_workspace_id || 'MISSING'}`);
    }
  });

  console.log(`\n📈 Summary:`);
  console.log(`   Workspaces with accounts: ${workspacesWithAccounts.length}`);
  console.log(`   Workspaces WITHOUT accounts: ${workspacesWithoutAccounts.length}`);
  console.log(`   Total accounts in DB: ${Object.values(accountCounts).reduce((a, b) => a + b, 0)}`);

  if (workspacesWithoutAccounts.length > 0) {
    console.log(`\n❌ Missing workspaces (${workspacesWithoutAccounts.length}):`);
    workspacesWithoutAccounts.forEach(w => {
      console.log(`   - ${w.name} (${w.instance})`);
      console.log(`     • API Key: ${w.hasApiKey ? '✅ Present' : '❌ Missing'}`);
      console.log(`     • Workspace ID: ${w.workspaceId || '❌ Missing'}`);
    });

    console.log(`\n💡 Possible Reasons:`);
    console.log(`   1. Missing bison_workspace_id in client_registry`);
    console.log(`   2. Missing or incorrect bison_api_key`);
    console.log(`   3. Workspace has no email accounts in Email Bison`);
    console.log(`   4. Polling job timed out before reaching these workspaces`);
    console.log(`   5. API authentication failing for these workspaces`);
  }
}

findMissingWorkspaces().catch(console.error);
