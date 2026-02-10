import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuthSystemStatus() {
  console.log('=== CHECKING AUTH SYSTEM STATUS ===\n');

  // 1. Check if user_workspace_access table exists
  console.log('1. Checking if user_workspace_access table exists...');
  const { data: accessData, error: accessError } = await supabase
    .from('user_workspace_access')
    .select('*')
    .limit(10);

  if (accessError) {
    console.log('❌ user_workspace_access table does NOT exist');
    console.log('Error:', accessError.message);
    console.log('\n⚠️  This means the auth migration (20251015000000_create_auth_system.sql) has NOT been applied!');
    console.log('\nIMPACT:');
    console.log('- If RLS policies requiring user_workspace_access are active, authenticated users will see NO leads');
    console.log('- Unauthenticated (anon) users should still see all leads via "Anon read access for admin dashboard" policy');
  } else {
    console.log('✓ user_workspace_access table exists');
    console.log(`Found ${accessData?.length || 0} access records\n`);

    if (accessData && accessData.length > 0) {
      console.log('Sample access records:');
      accessData.forEach((access, i) => {
        console.log(`  ${i + 1}. User: ${access.user_id}, Workspace: ${access.workspace_name}`);
      });
    } else {
      console.log('⚠️  Table exists but is EMPTY - no users have workspace access!');
    }
  }

  // 2. Check if auth.users table has any users
  console.log('\n2. Checking for authenticated users...');
  try {
    // Try to access auth.users (this might fail with anon key)
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.log('Cannot access auth.users with anon key (expected)');
    } else {
      console.log(`Found ${userData?.users?.length || 0} users in auth.users`);
    }
  } catch (e) {
    console.log('Cannot check auth.users with anon key (expected)');
  }

  // 3. Check current RLS policies on client_leads
  console.log('\n3. Checking client_leads table access...');
  const { data: clientLeads, error: clientLeadsError } = await supabase
    .from('client_leads')
    .select('id, workspace_name')
    .limit(5);

  if (clientLeadsError) {
    console.log('❌ Cannot access client_leads table');
    console.log('Error:', clientLeadsError.message);
    console.log('\nThis suggests RLS policies are BLOCKING anon access!');
  } else {
    console.log('✓ Can access client_leads table (anon access working)');
    console.log(`Sample workspaces: ${clientLeads?.map(l => l.workspace_name).join(', ')}`);
  }

  // 4. Test David Amiri specific access
  console.log('\n4. Testing David Amiri workspace access...');
  const { data: davidLeads, error: davidError } = await supabase
    .from('client_leads')
    .select('id')
    .eq('workspace_name', 'David Amiri')
    .limit(1);

  if (davidError) {
    console.log('❌ Cannot access David Amiri leads');
    console.log('Error:', davidError.message);
  } else {
    console.log(`✓ Can access David Amiri leads: ${davidLeads?.length || 0} found`);
  }

  // 5. Summary and recommendations
  console.log('\n\n=== SUMMARY & RECOMMENDATIONS ===\n');

  if (accessError) {
    console.log('🔴 ISSUE FOUND: Auth system migration not applied');
    console.log('\nRECOMMENDED FIX:');
    console.log('1. The migration file is present but not applied to database');
    console.log('2. Run the migration: supabase/migrations/20251015000000_create_auth_system.sql');
    console.log('3. This will create the auth system tables');
    console.log('\nALTERNATIVE:');
    console.log('If you don\'t want to use the auth system yet, ensure the "Allow all operations on client_leads" policy is active');
  } else if (!accessData || accessData.length === 0) {
    console.log('🟡 WARNING: Auth system tables exist but no users have workspace access');
    console.log('\nRECOMMENDED FIX:');
    console.log('1. Create user accounts for clients');
    console.log('2. Grant workspace access in user_workspace_access table');
    console.log('3. Example: INSERT INTO user_workspace_access (user_id, workspace_name) VALUES (\'user-uuid\', \'David Amiri\');');
  } else {
    console.log('✓ Auth system appears to be set up correctly');
  }
}

checkAuthSystemStatus().catch(console.error);
