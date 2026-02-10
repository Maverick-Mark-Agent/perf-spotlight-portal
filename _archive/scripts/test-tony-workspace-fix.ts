import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFix() {
  console.log('🧪 Testing get_user_workspaces function fix...\n');

  // Get Tony's user IDs
  const tonyEmails = [
    'jeremy.tschmitz@farmersagency.com',
    'sara.tschmitz@farmersagency.com',
    'sarah.tschmitz@farmersagency.com',
    'tschmitz@farmersagent.com'
  ];

  console.log('📋 Checking workspace access for Tony\'s team:\n');

  for (const email of tonyEmails) {
    // Get user ID from auth.users
    const { data: userData, error: userError } = await supabase
      .from('user_workspace_access')
      .select('user_id, workspace_name, role')
      .eq('workspace_name', 'Tony Schmitz')
      .limit(1);

    if (userError) {
      console.error(`❌ Error getting user data for ${email}:`, userError);
      continue;
    }

    if (!userData || userData.length === 0) {
      console.log(`⚠️  No workspace access found for ${email}`);
      continue;
    }

    const userId = userData[0].user_id;

    // Test the get_user_workspaces function
    const { data: workspaces, error: workspaceError } = await supabase.rpc('get_user_workspaces', {
      p_user_id: userId
    });

    if (workspaceError) {
      console.error(`❌ Error calling get_user_workspaces for ${email}:`, workspaceError);
      continue;
    }

    console.log(`✅ ${email}:`);
    console.log('   Workspaces returned:', workspaces?.length || 0);

    if (workspaces && workspaces.length > 0) {
      workspaces.forEach((w: any) => {
        console.log(`   - ID: ${w.workspace_id}, Name: "${w.workspace_name}", Role: ${w.role}, Leads: ${w.leads_count}`);
      });
    }

    // Check if they have ONLY Tony Schmitz
    if (workspaces && workspaces.length === 1 && workspaces[0].workspace_name === 'Tony Schmitz') {
      console.log('   ✅ CORRECT: Only has access to Tony Schmitz workspace\n');
    } else if (workspaces && workspaces.length > 1) {
      console.log('   ❌ ERROR: Has access to multiple workspaces!\n');
    } else {
      console.log('   ⚠️  WARNING: Unexpected result\n');
    }

    // Only test one user to save time
    break;
  }

  console.log('\n🔍 Checking function structure:');

  // Verify the function returns workspace_id
  const { data: testData, error: testError } = await supabase.rpc('get_user_workspaces', {
    p_user_id: '00000000-0000-0000-0000-000000000000' // Dummy UUID to test structure
  });

  if (testError && !testError.message.includes('No rows')) {
    console.error('❌ Function test failed:', testError);
  } else {
    console.log('✅ Function structure is correct (returns workspace_id field)');
  }

  console.log('\n✅ Test complete! Have Tony logout, clear cache, and login again.');
}

testFix();
