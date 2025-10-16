import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseClientAccess() {
  console.log('🔍 Diagnosing client portal access issue...\n');

  // Check one of Tony's users
  const tonyEmail = 'jeremy.tschmitz@farmersagency.com';

  console.log(`📋 Checking access for: ${tonyEmail}\n`);

  // 1. Check user_workspace_access table
  console.log('1. Checking user_workspace_access records...');
  const { data: accessRecords, error: accessError } = await supabase
    .from('user_workspace_access')
    .select('user_id, workspace_name, role')
    .limit(10);

  if (accessError) {
    console.error('❌ Error querying user_workspace_access:', accessError);
  } else {
    console.log(`   Found ${accessRecords?.length || 0} access records (showing first 10):`);
    accessRecords?.forEach((record: any) => {
      console.log(`   - User: ${record.user_id.substring(0, 8)}..., Workspace: "${record.workspace_name}", Role: ${record.role}`);
    });
  }

  console.log('\n2. Testing get_user_workspaces function with a sample user...');

  if (accessRecords && accessRecords.length > 0) {
    const testUserId = accessRecords[0].user_id;
    const testUserRole = accessRecords[0].role;

    console.log(`   Testing with user: ${testUserId.substring(0, 8)}... (role: ${testUserRole})`);

    const { data: workspaces, error: workspaceError } = await supabase.rpc('get_user_workspaces', {
      p_user_id: testUserId
    });

    if (workspaceError) {
      console.error('   ❌ Error calling get_user_workspaces:', workspaceError);
      console.log('\n   DIAGNOSIS: The function might have an error. Check the function definition.');
    } else {
      console.log(`   ✅ Function returned ${workspaces?.length || 0} workspaces`);
      if (workspaces && workspaces.length > 0) {
        workspaces.slice(0, 5).forEach((w: any) => {
          console.log(`      - ${w.workspace_name} (ID: ${w.workspace_id}, Role: ${w.role})`);
        });
      } else {
        console.log('   ⚠️  WARNING: Function returned 0 workspaces!');
      }
    }
  }

  console.log('\n3. Checking client_registry table...');
  const { data: registryCount, error: registryError } = await supabase
    .from('client_registry')
    .select('workspace_name', { count: 'exact' });

  if (registryError) {
    console.error('   ❌ Error querying client_registry:', registryError);
  } else {
    console.log(`   ✅ Total workspaces in client_registry: ${registryCount?.length || 0}`);
  }

  console.log('\n4. Checking RLS policies on client_leads...');
  console.log('   Note: RLS policies can only be checked via SQL query in Supabase dashboard');
  console.log('   Run this query to see active policies:');
  console.log('   SELECT * FROM pg_policies WHERE tablename = \'client_leads\';');

  console.log('\n📊 POSSIBLE ISSUES:');
  console.log('1. get_user_workspaces function may have syntax error after update');
  console.log('2. Function may not be returning data for client users');
  console.log('3. RLS policies may be too restrictive');
  console.log('4. client_registry table may not have workspace_id for some workspaces');
  console.log('\nNext step: Check function definition and test with specific user IDs');
}

diagnoseClientAccess();
