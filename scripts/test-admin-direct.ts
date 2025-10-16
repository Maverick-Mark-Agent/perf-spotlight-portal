import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdmin() {
  console.log('🧪 Testing admin workspace access...\n');

  // Aroosa's admin user ID
  const adminUserId = 'c4beb794-c339-4862-ae68-9660740c20e1';
  const adminEmail = 'aroosa@maverickmarketingllc.com';

  console.log(`Testing with: ${adminEmail}`);
  console.log(`User ID: ${adminUserId}\n`);

  // Call the function directly
  const { data, error } = await supabase.rpc('get_user_workspaces', {
    p_user_id: adminUserId
  });

  if (error) {
    console.error('❌ Error calling get_user_workspaces:', error);
  } else {
    console.log(`✅ Function returned ${data?.length || 0} workspaces:\n`);

    if (data && data.length > 0) {
      console.log('First 10 workspaces:');
      data.slice(0, 10).forEach((w: any, idx: number) => {
        console.log(`   ${idx + 1}. ${w.workspace_name} (ID: ${w.workspace_id}, Leads: ${w.leads_count})`);
      });

      if (data.length > 10) {
        console.log(`   ... and ${data.length - 10} more workspaces\n`);
      }

      if (data.length > 20) {
        console.log('✅ SUCCESS: Admin sees all workspaces!');
      } else {
        console.log('⚠️  Admin should see more workspaces (expected 35+)');
      }
    }
  }
}

testAdmin();
