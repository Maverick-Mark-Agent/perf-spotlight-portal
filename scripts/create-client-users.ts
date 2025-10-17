import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.yaez3rq1VHStAH9dV0lLJtd-tyOnJcwYhzHSr7fX1XA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  'jroberts7@farmersagent.com',
  'dvamiri@gmail.com',
  'mj@kwallaceagency.com',
  'ap2@binyon.agency',
  'kim@kwallaceagency.com',
  'matthew.tomeny@assuredpartners.com',
  'kirk.hodgson@assuredpartners.com',
  'lindsaylewis2@allstate.com',
  'nskeltis@allstate.com',
  'jacobback@allstate.com',
  'aprzybysz1@allstate.com',
  'mpina-orozco@allstate.com',
  'Nicholas.sakha@gmail.com',
  'vhansell@allstate.com',
  'cbrough@fbinsmi.com',
  'rob.russell@fbinsmi.com',
  'steve@texhq.net',
  'victor@smains.com',
  'jake@streetsmart.insurance',
  'carlo@streetsmart.insurance',
  'eunice@streetsmart.insurance',
  'jose@streetsmart.insurance',
  'joe@streetsmart.insurance'
];

const password = '12345';

async function createUsers() {
  console.log('👥 Creating client users in Supabase Auth...\n');
  console.log('='.repeat(60));

  const results = {
    created: [] as string[],
    alreadyExists: [] as string[],
    failed: [] as { email: string; error: string }[]
  };

  for (const email of users) {
    try {
      console.log(`\n📧 Creating user: ${email}`);

      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true // Auto-confirm email so they can login immediately
      });

      if (error) {
        if (error.message.includes('already registered')) {
          console.log('   ⚠️  User already exists');
          results.alreadyExists.push(email);
        } else {
          console.log(`   ❌ Error: ${error.message}`);
          results.failed.push({ email, error: error.message });
        }
      } else {
        console.log('   ✅ Created successfully');
        results.created.push(email);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      console.log(`   ❌ Exception: ${error.message}`);
      results.failed.push({ email, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY:\n');

  console.log(`✅ Created: ${results.created.length} users`);
  if (results.created.length > 0) {
    results.created.forEach(email => {
      console.log(`   - ${email}`);
    });
  }

  console.log(`\n⚠️  Already Exists: ${results.alreadyExists.length} users`);
  if (results.alreadyExists.length > 0) {
    results.alreadyExists.forEach(email => {
      console.log(`   - ${email}`);
    });
  }

  console.log(`\n❌ Failed: ${results.failed.length} users`);
  if (results.failed.length > 0) {
    results.failed.forEach(({ email, error }) => {
      console.log(`   - ${email}: ${error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🔐 LOGIN CREDENTIALS:\n');
  console.log('All users have been created with the following credentials:\n');
  console.log('Password: 12345\n');
  console.log('Users can login at: https://www.maverickmarketingllc.com/login\n');

  console.log('📋 NEXT STEPS:\n');
  console.log('1. Go to User Management: https://www.maverickmarketingllc.com/user-management');
  console.log('2. Find each user in the list');
  console.log('3. Click "Add Workspace" to assign them to their client portal');
  console.log('4. Select the workspace and role (usually "client")');
  console.log('5. User can then login and see their assigned workspace\n');

  console.log('✅ User creation complete!\n');
}

createUsers();
