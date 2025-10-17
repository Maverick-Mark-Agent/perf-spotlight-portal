import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addTommyAsAdmin() {
  const email = 'thomaschavez@maverickmarketingllc.com';

  console.log(`Looking up user with email: ${email}...\n`);

  // Get user ID from auth.users
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  const user = users?.find(u => u.email === email);

  if (!user) {
    console.error(`User with email ${email} not found!`);
    console.log('\nAvailable users:');
    users?.forEach(u => console.log(`  - ${u.email}`));
    return;
  }

  console.log(`Found user: ${user.email}`);
  console.log(`User ID: ${user.id}\n`);

  // Add admin role
  console.log('Adding admin role to user_workspace_access...');

  const { data, error } = await supabase
    .from('user_workspace_access')
    .insert({
      user_id: user.id,
      workspace_name: 'admin',
      role: 'admin',
    })
    .select();

  if (error) {
    console.error('Error adding admin role:', error);
    return;
  }

  console.log('✅ Successfully added admin role!');
  console.log('Data:', data);

  // Verify
  console.log('\nVerifying admin access...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('user_workspace_access')
    .select('*')
    .eq('user_id', user.id)
    .eq('role', 'admin');

  if (verifyError) {
    console.error('Error verifying:', verifyError);
    return;
  }

  console.log('✅ Verification successful!');
  console.log('Admin access entries:', verifyData);
}

addTommyAsAdmin();
