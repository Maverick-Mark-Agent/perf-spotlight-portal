import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testWorkspaceAPI(workspaceName: string) {
  console.log(`\n🔍 Testing ${workspaceName}...`);
  console.log('='.repeat(60));

  // Get workspace details
  const { data: workspace } = await supabase
    .from('client_registry')
    .select('*')
    .eq('workspace_name', workspaceName)
    .single();

  if (!workspace) {
    console.log('❌ Workspace not found in database');
    return;
  }

  console.log('📊 Configuration:');
  console.log('   Instance:', workspace.bison_instance);
  console.log('   Workspace ID:', workspace.bison_workspace_id);
  console.log('   Has API Key:', workspace.bison_api_key ? 'Yes' : 'No');
  console.log('   Is Active:', workspace.is_active);

  if (!workspace.bison_api_key) {
    console.log('❌ No API key configured - will use global key');
    return;
  }

  // Test API call
  console.log('\n🔍 Testing Email Bison API...');

  const baseUrl = workspace.bison_instance === 'Long Run'
    ? 'https://send.longrun.agency/api'
    : 'https://send.maverickmarketingllc.com/api';

  const apiKey = workspace.bison_api_key;

  try {
    const response = await fetch(`${baseUrl}/sender-emails?per_page=1000`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    console.log('   HTTP Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('   ❌ Error Response:', errorText.substring(0, 200));
      return;
    }

    const data = await response.json();

    if (data.data) {
      console.log('   ✅ Accounts returned:', data.data.length);

      if (data.data.length > 0) {
        console.log('\n   Sample accounts:');
        data.data.slice(0, 5).forEach((acc: any) => {
          console.log(`     - ${acc.email}: ${acc.total_sent || 0} sent total, ${acc.email_sent_last_30 || 0} last 30d`);
        });
      } else {
        console.log('   ⚠️  API returned 0 accounts - workspace might not have any email accounts set up yet');
      }
    } else {
      console.log('   ⚠️  Unexpected response format:', Object.keys(data));
    }

  } catch (error: any) {
    console.log('❌ API call failed:', error.message);
  }
}

async function main() {
  console.log('🧪 Testing API Keys for Missing Workspaces\n');

  const missingWorkspaces = [
    'Castle Agency',
    'Maverick In-house',
    'Schrauf Agency',
    'StreetSmart P&C'
  ];

  for (const workspace of missingWorkspaces) {
    await testWorkspaceAPI(workspace);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ API testing complete');
}

main().catch(console.error);
