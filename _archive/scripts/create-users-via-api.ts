// Using native fetch (Node 18+)

const projectRef = 'gjqbbgrfhijescaouqkx';
const accessToken = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';

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
  console.log('👥 Creating client users via Supabase Management API...\n');
  console.log('='.repeat(60));

  const results = {
    created: [] as string[],
    alreadyExists: [] as string[],
    failed: [] as { email: string; error: string }[]
  };

  for (const email of users) {
    try {
      console.log(`\n📧 Creating user: ${email}`);

      const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            -- Create user in auth.users
            INSERT INTO auth.users (
              instance_id,
              id,
              aud,
              role,
              email,
              encrypted_password,
              email_confirmed_at,
              created_at,
              updated_at,
              confirmation_token,
              email_change_token_current,
              email_change_token_new
            )
            SELECT
              '00000000-0000-0000-0000-000000000000'::uuid,
              gen_random_uuid(),
              'authenticated',
              'authenticated',
              '${email}',
              crypt('${password}', gen_salt('bf')),
              NOW(),
              NOW(),
              NOW(),
              '',
              '',
              ''
            WHERE NOT EXISTS (
              SELECT 1 FROM auth.users WHERE email = '${email}'
            );

            -- Return result
            SELECT
              CASE
                WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = '${email}')
                THEN 'exists'
                ELSE 'error'
              END as status;
          `
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.log(`   ❌ API Error: ${JSON.stringify(result)}`);
        results.failed.push({ email, error: JSON.stringify(result) });
      } else {
        console.log('   ✅ Created successfully');
        results.created.push(email);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

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
  console.log('\n🔐 LOGIN CREDENTIALS FOR ALL USERS:\n');
  console.log('Email: [user email from list above]');
  console.log('Password: 12345\n');
  console.log('Login at: https://www.maverickmarketingllc.com/login\n');

  console.log('📋 NEXT STEPS:\n');
  console.log('1. Go to: https://www.maverickmarketingllc.com/user-management');
  console.log('2. Find each user by email');
  console.log('3. Click "Add Workspace" button');
  console.log('4. Select their workspace and role (client)');
  console.log('5. User can then login with password: 12345\n');
}

createUsers();
