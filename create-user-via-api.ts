import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const EMAIL = 'hassan@maverickmarketingllc.com';
const PASSWORD = '123456';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('================================================================================');
  console.log('CREATING DASHBOARD USER FOR HASSAN');
  console.log('================================================================================');
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log('================================================================================\n');

  try {
    // Step 1: Sign up the user
    console.log('Step 1: Signing up user...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
      options: {
        emailRedirectTo: 'https://www.maverickmarketingllc.com',
      }
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        console.log('ℹ️  User already registered. Attempting to sign in to verify...');

        // Try to sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: EMAIL,
          password: PASSWORD,
        });

        if (signInError) {
          console.log('⚠️  User exists but password might be different. You may need to reset it manually.');
          console.log('Error:', signInError.message);

          console.log('\n================================================================================');
          console.log('USER ALREADY EXISTS');
          console.log('================================================================================');
          console.log('Please use the Supabase dashboard to:');
          console.log('1. Go to Authentication > Users');
          console.log('2. Find hassan@maverickmarketingllc.com');
          console.log('3. Update the password to: 12345');
          console.log('4. Verify workspace access in user_workspace_access table');
          console.log('================================================================================');
          return;
        }

        console.log('✅ User verified - already exists with correct password');
        const userId = signInData.user.id;

        // Check workspace access
        console.log('\nStep 2: Checking workspace access...');
        const { data: accessData, error: accessError } = await supabase
          .from('user_workspace_access')
          .select('*')
          .eq('user_id', userId)
          .eq('workspace_name', 'admin');

        if (accessError) {
          console.error('Error checking access:', accessError);
        } else if (!accessData || accessData.length === 0) {
          console.log('⚠️  User does not have admin access. Adding it...');

          const { error: insertError } = await supabase
            .from('user_workspace_access')
            .insert({
              user_id: userId,
              workspace_name: 'admin',
              role: 'admin',
            });

          if (insertError) {
            console.error('❌ Failed to add admin access:', insertError);
            console.log('\nPlease manually add admin access via SQL:');
            console.log(`INSERT INTO user_workspace_access (user_id, workspace_name, role)`);
            console.log(`VALUES ('${userId}', 'admin', 'admin');`);
          } else {
            console.log('✅ Admin access added');
          }
        } else {
          console.log('✅ User already has admin access');
        }

      } else {
        throw signUpError;
      }
    } else {
      if (!signUpData.user) {
        throw new Error('User creation failed - no user returned');
      }

      const userId = signUpData.user.id;
      console.log(`✅ User created successfully with ID: ${userId}`);

      // Step 2: Add admin workspace access
      console.log('\nStep 2: Adding admin workspace access...');
      const { error: workspaceError } = await supabase
        .from('user_workspace_access')
        .insert({
          user_id: userId,
          workspace_name: 'admin',
          role: 'admin',
        });

      if (workspaceError) {
        console.error('Error adding workspace access:', workspaceError);
        if (workspaceError.code === '23505') {
          console.log('ℹ️  Admin access already exists');
        } else {
          console.log('\n⚠️  Could not add workspace access automatically.');
          console.log('Please manually add it via SQL:');
          console.log(`INSERT INTO user_workspace_access (user_id, workspace_name, role)`);
          console.log(`VALUES ('${userId}', 'admin', 'admin');`);
        }
      } else {
        console.log('✅ Admin workspace access added');
      }
    }

    console.log('\n================================================================================');
    console.log('SETUP COMPLETE!');
    console.log('================================================================================');
    console.log(`Hassan can now login to the dashboard with:`);
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