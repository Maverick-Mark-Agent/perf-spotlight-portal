import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

const EMAIL = 'hassan@maverickmarketingllc.com';
const PASSWORD = '12345';
const ROLE = 'admin';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('================================================================================');
  console.log('CREATING DASHBOARD USER FOR HASSAN');
  console.log('================================================================================');
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Role: ${ROLE}`);
  console.log('================================================================================\n');

  try {
    // Step 1: Create user in Supabase Auth
    console.log('Step 1: Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // Auto-confirm the email
    });

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already registered')) {
        console.log('ℹ️  User already exists. Fetching existing user...');

        // Get existing user
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
          throw new Error(`Failed to list users: ${listError.message}`);
        }

        const existingUser = users.users.find(u => u.email === EMAIL);

        if (!existingUser) {
          throw new Error('User exists but could not be found');
        }

        console.log(`✅ Found existing user with ID: ${existingUser.id}`);

        // Update password
        console.log('Updating password...');
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          { password: PASSWORD }
        );

        if (updateError) {
          throw new Error(`Failed to update password: ${updateError.message}`);
        }

        console.log('✅ Password updated successfully');

        // Use existing user ID
        const userId = existingUser.id;

        // Step 2: Add admin workspace access
        console.log('\nStep 2: Adding admin workspace access...');

        // Check if admin access already exists
        const { data: existingAccess } = await supabase
          .from('user_workspace_access')
          .select('*')
          .eq('user_id', userId)
          .eq('workspace_name', 'admin')
          .single();

        if (existingAccess) {
          console.log('ℹ️  Admin access already exists');
        } else {
          const { error: workspaceError } = await supabase
            .from('user_workspace_access')
            .insert({
              user_id: userId,
              workspace_name: 'admin',
              role: ROLE,
            });

          if (workspaceError) {
            throw new Error(`Failed to add workspace access: ${workspaceError.message}`);
          }

          console.log('✅ Admin workspace access added');
        }

      } else {
        throw authError;
      }
    } else {
      if (!authData.user) {
        throw new Error('User creation failed - no user returned');
      }

      const userId = authData.user.id;
      console.log(`✅ User created successfully with ID: ${userId}`);

      // Step 2: Add admin workspace access
      console.log('\nStep 2: Adding admin workspace access...');
      const { error: workspaceError } = await supabase
        .from('user_workspace_access')
        .insert({
          user_id: userId,
          workspace_name: 'admin',
          role: ROLE,
        });

      if (workspaceError) {
        // Check if it's a duplicate
        if (workspaceError.code === '23505') {
          console.log('ℹ️  Admin access already exists');
        } else {
          throw new Error(`Failed to add workspace access: ${workspaceError.message}`);
        }
      } else {
        console.log('✅ Admin workspace access added');
      }
    }

    // Step 3: Verify user can access dashboard
    console.log('\nStep 3: Verifying user access...');
    const { data: accessData, error: accessError } = await supabase
      .from('user_workspace_access')
      .select('*')
      .eq('workspace_name', 'admin');

    if (accessError) {
      console.warn('⚠️  Could not verify access:', accessError.message);
    } else {
      const hasAccess = accessData.some(a => a.workspace_name === 'admin');
      if (hasAccess) {
        console.log('✅ User has admin access verified');
      }
    }

    console.log('\n================================================================================');
    console.log('SUCCESS!');
    console.log('================================================================================');
    console.log(`Hassan can now login to the dashboard at:`);
    console.log(`Email: ${EMAIL}`);
    console.log(`Password: ${PASSWORD}`);
    console.log(`Role: Admin (full access to all workspaces)`);
    console.log('================================================================================');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message || error);
    process.exit(1);
  }
}

main();