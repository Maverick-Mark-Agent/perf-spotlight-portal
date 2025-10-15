import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkParentWebhooks() {
  console.log('=== CHECKING PARENT WORKSPACE WEBHOOKS ===\n');

  // We need the parent workspace API key
  // Based on earlier findings, parent workspace is ID 2

  // First, let's check if we have parent workspace credentials
  const { data: clients } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_api_key')
    .order('workspace_name');

  console.log('All workspaces in database:');
  clients?.forEach(c => {
    console.log(`  ${c.workspace_name} (ID: ${c.bison_workspace_id}) - API Key: ${c.bison_api_key ? 'Yes' : 'No'}`);
  });

  // Try to find parent workspace (ID 2)
  const parent = clients?.find(c => c.bison_workspace_id === 2);

  if (!parent) {
    console.log('\n⚠️ Parent workspace (ID 2) not found in database');
    console.log('Need to use parent workspace API key to check global webhooks');
    return;
  }

  console.log(`\n--- Checking Parent Workspace: ${parent.workspace_name} ---`);

  if (!parent.bison_api_key) {
    console.log('❌ No API key for parent workspace');
    return;
  }

  // Get webhooks from parent workspace
  const response = await fetch('https://send.maverickmarketingllc.com/api/webhook-url', {
    headers: {
      'Authorization': `Bearer ${parent.bison_api_key}`,
      'Content-Type': 'application/json'
    }
  });

  const webhooks = await response.json();

  console.log('\nWebhooks registered at PARENT level:');
  console.log(JSON.stringify(webhooks, null, 2));

  if (webhooks.data) {
    console.log(`\nTotal parent webhooks: ${webhooks.data.length}`);
    webhooks.data.forEach((wh: any) => {
      console.log(`\nWebhook #${wh.id}:`);
      console.log(`  Name: ${wh.name}`);
      console.log(`  URL: ${wh.url}`);
      console.log(`  Events: ${wh.events.join(', ')}`);
      console.log(`  Created: ${wh.created_at}`);
    });

    // Check if n8n webhook exists
    const n8nWebhook = webhooks.data.find((w: any) =>
      w.url.includes('longrun.up.railway.app')
    );

    if (n8nWebhook) {
      console.log('\n🔍 FOUND n8n WEBHOOK:');
      console.log(`  ID: ${n8nWebhook.id}`);
      console.log(`  URL: ${n8nWebhook.url}`);
      console.log('\n⚠️ This is a PARENT-LEVEL webhook that applies to ALL child workspaces!');
      console.log('   Parent webhooks OVERRIDE child workspace webhooks.');
      console.log('\n   This means Tony\'s webhook #115 is being ignored.');
    }
  }
}

checkParentWebhooks().catch(console.error);
