import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.s7d_copTor6yi_YNL-jHU-uXs0foPQbmT3c2u31Tyqw';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixTommyAdminAccess() {
  const email = 'thomaschavez@maverickmarketingllc.com';
  const userId = '09322929-6078-4b08-bd55-e3e1ff773028'; // From your console logs

  console.log(`Adding admin access for user: ${email}`);
  console.log(`User ID: ${userId}\n`);

  // Check if admin access already exists
  console.log('Checking existing admin access...');
  const { data: existing, error: checkError } = await supabase
    .from('user_workspace_access')
    .select('*')
    .eq('user_id', userId)
    .eq('role', 'admin');

  if (checkError) {
    console.error('Error checking existing access:', checkError);
    return;
  }

  console.log('Existing admin entries:', existing);

  if (existing && existing.length > 0) {
    console.log('\n✅ Admin access already exists!');
    return;
  }

  // Add admin role
  console.log('\nAdding admin role...');
  const { data: insertData, error: insertError } = await supabase
    .from('user_workspace_access')
    .insert({
      user_id: userId,
      workspace_name: 'admin',
      role: 'admin',
    })
    .select();

  if (insertError) {
    console.error('❌ Error adding admin role:', insertError);
    console.error('Error details:', JSON.stringify(insertError, null, 2));
    return;
  }

  console.log('✅ Successfully added admin role!');
  console.log('Data:', insertData);

  // Verify
  console.log('\nVerifying admin access...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('user_workspace_access')
    .select('*')
    .eq('user_id', userId)
    .eq('role', 'admin');

  if (verifyError) {
    console.error('Error verifying:', verifyError);
    return;
  }

  console.log('✅ Verification successful!');
  console.log('Admin access entries:', verifyData);
  console.log('\n🎉 Tommy now has admin access! Try logging in again.');
}

fixTommyAdminAccess().catch(console.error);
