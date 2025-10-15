import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAccess() {
  console.log('🧪 Testing User Management access...\n');

  // Test 1: Try to list users with auth.admin (will fail with anon key)
  console.log('Test 1: Trying supabase.auth.admin.listUsers()...');
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.log('❌ FAILED (expected):', error.message);
      console.log('   This requires service_role key, not anon key\n');
    } else {
      console.log('✅ Success:', data.users.length, 'users found\n');
    }
  } catch (err: any) {
    console.log('❌ Exception:', err.message, '\n');
  }

  // Test 2: Try to access user_workspace_access table
  console.log('Test 2: Trying to read user_workspace_access table...');
  try {
    const { data, error } = await supabase
      .from('user_workspace_access')
      .select('*')
      .limit(5);

    if (error) {
      console.log('❌ FAILED:', error.message, '\n');
    } else {
      console.log('✅ Success:', data?.length || 0, 'records found\n');
      if (data && data.length > 0) {
        console.log('   Sample record:', data[0]);
      }
    }
  } catch (err: any) {
    console.log('❌ Exception:', err.message, '\n');
  }

  // Test 3: Check RLS policies
  console.log('Test 3: Checking if we need to be authenticated...');
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    console.log('✅ User is authenticated:', session.user.email, '\n');
  } else {
    console.log('⚠️  No active session - user may not be logged in\n');
  }

  console.log('📋 DIAGNOSIS:');
  console.log('The User Management page requires:');
  console.log('1. Service role key (not anon key) to list all auth.users');
  console.log('2. OR we need to create an Edge Function to handle this');
  console.log('3. OR we need to create a custom database view/function\n');
}

testAccess();
