import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSpecificUser() {
  console.log('🧪 Testing get_user_workspaces with Tony\'s user...\n');

  // Jeremy's user ID from the query results
  const jeremyUserId = '656bc47a-2296-4c0c-977d-d0a51ce8b713';
  const jeremyEmail = 'jeremy.tschmitz@farmersagency.com';

  console.log(`Testing with: ${jeremyEmail}`);
  console.log(`User ID: ${jeremyUserId}\n`);

  // Call the function directly
  const { data, error } = await supabase.rpc('get_user_workspaces', {
    p_user_id: jeremyUserId
  });

  if (error) {
    console.error('❌ Error calling get_user_workspaces:', error);
    console.log('\nError details:', JSON.stringify(error, null, 2));
  } else {
    console.log(`✅ Function returned ${data?.length || 0} workspaces:\n`);

    if (data && data.length > 0) {
      data.forEach((w: any) => {
        console.log(`   - ${w.workspace_name}`);
        console.log(`     ID: ${w.workspace_id}`);
        console.log(`     Role: ${w.role}`);
        console.log(`     Leads: ${w.leads_count}`);
        console.log(`     Won Leads: ${w.won_leads_count}\n`);
      });

      console.log('✅ SUCCESS: Jeremy should see these workspaces!');
    } else {
      console.log('❌ PROBLEM: Function returned 0 workspaces');
      console.log('\nPossible issues:');
      console.log('1. The workspace_id in client_registry might be NULL for "Tony Schmitz"');
      console.log('2. There might be a name mismatch between user_workspace_access and client_registry');
      console.log('3. The LEFT JOIN might be failing');

      console.log('\nLet me check client_registry for "Tony Schmitz"...');
    }
  }

  // Check if Tony Schmitz exists in client_registry
  console.log('\n🔍 Checking client_registry for "Tony Schmitz"...');
  const { data: registryData, error: registryError } = await supabase
    .from('client_registry')
    .select('workspace_id, workspace_name')
    .eq('workspace_name', 'Tony Schmitz');

  if (registryError) {
    console.error('❌ Error querying client_registry:', registryError);
  } else if (registryData && registryData.length > 0) {
    console.log('✅ Found in client_registry:');
    registryData.forEach((w: any) => {
      console.log(`   - Name: "${w.workspace_name}", ID: ${w.workspace_id}`);
    });
  } else {
    console.log('❌ "Tony Schmitz" NOT FOUND in client_registry!');
    console.log('   This is the problem - the workspace needs to be added to client_registry');
  }

  // Check for name mismatches
  console.log('\n🔍 Checking for workspace name mismatches...');
  const { data: allRegistry } = await supabase
    .from('client_registry')
    .select('workspace_name')
    .ilike('workspace_name', '%tony%');

  if (allRegistry && allRegistry.length > 0) {
    console.log('Found these Tony-related workspaces in client_registry:');
    allRegistry.forEach((w: any) => {
      console.log(`   - "${w.workspace_name}"`);
    });
  }
}

testSpecificUser();
