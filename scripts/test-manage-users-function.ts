import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testManageUsersFunction() {
  console.log('🧪 Testing manage-users Edge Function...\n');

  // Test without authentication (should fail)
  console.log('1️⃣ Testing without authentication (should fail)...');
  try {
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'list_users'
      }
    });

    if (error) {
      console.log(`   ❌ Error (expected): ${error.message}`);
    } else {
      console.log('   ⚠️  Unexpected success:', data);
    }
  } catch (e: any) {
    console.log(`   ❌ Exception (expected): ${e.message}`);
  }

  // Test if function exists
  console.log('\n2️⃣ Checking if manage-users function is deployed...');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/manage-users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'list_users' })
    });

    const result = await response.json();

    if (response.status === 401 || response.status === 403) {
      console.log('   ✅ Function exists but requires authentication (correct!)');
    } else if (response.status === 404) {
      console.log('   ❌ Function NOT FOUND - needs to be deployed');
      console.log('\n   Deploy with:');
      console.log('   SUPABASE_ACCESS_TOKEN=sbp_765c83453a7d30be808b30e47cc230e0e9686015 npx supabase functions deploy manage-users --no-verify-jwt');
    } else {
      console.log(`   Status: ${response.status}`);
      console.log('   Result:', result);
    }
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  console.log('\n3️⃣ Checking Edge Function deployment status...');
  try {
    const projectRef = 'gjqbbgrfhijescaouqkx';
    const accessToken = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const functions = await response.json();

    if (Array.isArray(functions)) {
      const manageUsers = functions.find((f: any) => f.slug === 'manage-users');
      if (manageUsers) {
        console.log('   ✅ manage-users function is deployed');
        console.log('   Details:', JSON.stringify(manageUsers, null, 2));
      } else {
        console.log('   ❌ manage-users function NOT found in deployed functions');
        console.log('   Deployed functions:', functions.map((f: any) => f.slug));
      }
    } else {
      console.log('   Response:', functions);
    }
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  console.log('\n📋 DIAGNOSIS:');
  console.log('If function is NOT deployed:');
  console.log('  Run: SUPABASE_ACCESS_TOKEN=sbp_765c83453a7d30be808b30e47cc230e0e9686015 npx supabase functions deploy manage-users --no-verify-jwt');
  console.log('\nIf function IS deployed but not working:');
  console.log('  Check Supabase function logs for errors');
}

testManageUsersFunction();
