import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdminAccess() {
  console.log('🧪 Testing admin workspace access...\n');

  // Check current session
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.log('❌ No active session. Please login first.\n');
    console.log('To test, you need to be logged in as an admin user.');
    return;
  }

  console.log('✅ Logged in as:', session.user.email);
  console.log('   User ID:', session.user.id, '\n');

  // Check if user has admin role
  console.log('🔍 Checking admin role...');
  const { data: adminCheck, error: adminError } = await supabase
    .from('user_workspace_access')
    .select('workspace_name, role')
    .eq('user_id', session.user.id)
    .eq('role', 'admin');

  if (adminError) {
    console.error('❌ Error checking admin role:', adminError);
    return;
  }

  if (adminCheck && adminCheck.length > 0) {
    console.log('✅ User IS an admin');
    console.log('   Admin entries:', adminCheck);
  } else {
    console.log('⚠️  User is NOT an admin');
  }

  console.log('\n🔍 Calling get_user_workspaces function...');

  // Test the get_user_workspaces function
  const { data: workspaces, error: workspaceError } = await supabase.rpc('get_user_workspaces', {
    p_user_id: session.user.id
  });

  if (workspaceError) {
    console.error('❌ Error calling function:', workspaceError);
    return;
  }

  console.log(`✅ Function returned ${workspaces?.length || 0} workspaces:\n`);

  if (workspaces && workspaces.length > 0) {
    workspaces.slice(0, 10).forEach((w: any, idx: number) => {
      console.log(`   ${idx + 1}. ${w.workspace_name} (ID: ${w.workspace_id}, Role: ${w.role}, Leads: ${w.leads_count})`);
    });

    if (workspaces.length > 10) {
      console.log(`   ... and ${workspaces.length - 10} more workspaces`);
    }
  }

  console.log('\n🔍 Checking total workspaces in client_registry...');
  const { data: allWorkspaces, error: registryError } = await supabase
    .from('client_registry')
    .select('workspace_name', { count: 'exact' });

  if (registryError) {
    console.error('❌ Error querying client_registry:', registryError);
  } else {
    console.log(`✅ Total workspaces in client_registry: ${allWorkspaces?.length || 0}`);
  }

  console.log('\n📊 DIAGNOSIS:');
  if (adminCheck && adminCheck.length > 0) {
    if (workspaces && workspaces.length === allWorkspaces?.length) {
      console.log('✅ SUCCESS: Admin is seeing ALL workspaces!');
    } else {
      console.log('❌ PROBLEM: Admin should see ALL workspaces but only seeing', workspaces?.length);
      console.log('   Expected:', allWorkspaces?.length);
      console.log('   Got:', workspaces?.length);
      console.log('\n   Possible issues:');
      console.log('   1. Function may not have been updated correctly');
      console.log('   2. RLS policies may be blocking access');
      console.log('   3. There may be a caching issue');
    }
  } else {
    console.log('⚠️  User is not an admin, so they should only see their assigned workspaces');
  }
}

testAdminAccess();
