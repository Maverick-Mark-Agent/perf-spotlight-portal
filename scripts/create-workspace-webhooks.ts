import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

const WEBHOOK_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

interface WorkspaceConfig {
  workspace_name: string;
  bison_workspace_id: number;
  bison_instance: string;
  bison_api_key: string | null;
  is_active: boolean;
}

async function createWorkspaceWebhooks() {
  console.log('🔗 Creating Workspace-Specific Webhooks\n');
  console.log('═'.repeat(120));
  console.log('\n📋 ARCHITECTURE: Workspace-Specific Webhooks\n');
  console.log('Each client gets their own webhook using their workspace-specific API key');
  console.log('No super admin fallback - enforces proper key management\n');
  console.log('═'.repeat(120));

  // Fetch all active clients with workspace-specific API keys
  const { data: workspaces, error: wsError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key, is_active')
    .eq('is_active', true)
    .not('bison_api_key', 'is', null)
    .order('workspace_name');

  if (wsError || !workspaces) {
    console.error('❌ Error fetching workspaces:', wsError);
    return;
  }

  console.log(`\n✅ Found ${workspaces.length} active clients with workspace-specific API keys\n`);

  // Also check for clients WITHOUT keys
  const { data: missingKeys } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance')
    .eq('is_active', true)
    .is('bison_api_key', null);

  if (missingKeys && missingKeys.length > 0) {
    console.log(`⚠️  WARNING: ${missingKeys.length} active client(s) without API keys:\n`);
    for (const client of missingKeys) {
      console.log(`   ❌ ${client.workspace_name} (${client.bison_instance})`);
    }
    console.log('\n   These clients will be skipped. Create API keys for them first.\n');
    console.log('═'.repeat(120));
  }

  const results = {
    created: [] as string[],
    alreadyExists: [] as string[],
    failed: [] as { workspace: string; error: string }[],
    skipped: [] as string[],
  };

  for (const workspace of workspaces) {
    console.log(`\n${'─'.repeat(120)}`);
    console.log(`\n📨 ${workspace.workspace_name} (${workspace.bison_instance})`);

    const baseUrl = workspace.bison_instance === 'Maverick'
      ? 'https://send.maverickmarketingllc.com/api'
      : 'https://send.longrun.agency/api';

    if (!workspace.bison_api_key) {
      console.log('   ⚠️  No workspace API key - skipping');
      results.skipped.push(workspace.workspace_name);
      continue;
    }

    try {
      // Check if webhook already exists
      console.log('   Checking for existing webhooks...');

      const listResponse = await fetch(`${baseUrl}/webhook-url`, {
        headers: {
          'Authorization': `Bearer ${workspace.bison_api_key}`,
          'Accept': 'application/json',
        },
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to list webhooks: ${listResponse.status} ${listResponse.statusText}`);
      }

      const webhooksData = await listResponse.json();
      const webhooks = webhooksData.data || [];

      // Check if our webhook URL already exists
      const existing = webhooks.find((wh: any) =>
        wh.url && wh.url.includes('universal-bison-webhook')
      );

      if (existing) {
        console.log(`   ✅ Webhook already exists (ID: ${existing.id})`);
        console.log(`      URL: ${existing.url}`);
        console.log(`      Events: ${Array.isArray(existing.events) ? existing.events.join(', ') : 'lead_interested'}`);
        results.alreadyExists.push(workspace.workspace_name);

        // Update client registry with webhook info
        await supabase
          .from('client_registry')
          .update({
            bison_webhook_url: existing.url,
            bison_webhook_enabled: true,
            bison_webhook_events: existing.events || ['lead_interested'],
          })
          .eq('workspace_name', workspace.workspace_name);

        continue;
      }

      // Create new webhook
      console.log('   Creating new webhook...');

      const createResponse = await fetch(`${baseUrl}/webhook-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${workspace.bison_api_key}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${workspace.workspace_name} - Interested Leads Webhook`,
          url: WEBHOOK_URL,
          events: ['lead_interested'],  // Array of event names
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create webhook: ${createResponse.status} - ${errorText}`);
      }

      const webhookData = await createResponse.json();
      const newWebhook = webhookData.data;

      if (!newWebhook || !newWebhook.id) {
        throw new Error('No webhook ID returned from Email Bison');
      }

      console.log(`   ✅ Created webhook (ID: ${newWebhook.id})`);
      console.log(`      URL: ${WEBHOOK_URL}`);
      console.log(`      Event: lead_interested`);

      results.created.push(workspace.workspace_name);

      // Update client registry
      await supabase
        .from('client_registry')
        .update({
          bison_webhook_url: WEBHOOK_URL,
          bison_webhook_enabled: true,
          bison_webhook_events: ['lead_interested'],
        })
        .eq('workspace_name', workspace.workspace_name);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      results.failed.push({
        workspace: workspace.workspace_name,
        error: error.message,
      });
    }
  }

  console.log(`\n${'═'.repeat(120)}\n`);
  console.log('📊 WEBHOOK CREATION SUMMARY\n');
  console.log(`Total Workspaces Processed: ${workspaces.length}`);
  console.log(`✅ Webhooks Created: ${results.created.length}`);
  console.log(`✓  Already Existed: ${results.alreadyExists.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Skipped (no API key): ${results.skipped.length}\n`);

  if (results.created.length > 0) {
    console.log('✅ Successfully Created Webhooks:');
    results.created.forEach(name => console.log(`   • ${name}`));
    console.log('');
  }

  if (results.alreadyExists.length > 0) {
    console.log('✓  Webhooks Already Existed:');
    results.alreadyExists.forEach(name => console.log(`   • ${name}`));
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('❌ Failed to Create Webhooks:');
    results.failed.forEach(item => console.log(`   • ${item.workspace}: ${item.error}`));
    console.log('');
  }

  if (results.skipped.length > 0) {
    console.log('⚠️  Skipped (No API Key):');
    results.skipped.forEach(name => console.log(`   • ${name}`));
    console.log('');
  }

  console.log('═'.repeat(120));
  console.log('\n🎯 NEXT STEPS:\n');
  console.log('1. Deploy the universal-bison-webhook function if not already deployed');
  console.log('2. Test webhooks by marking a lead as interested in Email Bison');
  console.log('3. Check webhook_delivery_log table for incoming webhooks');
  console.log('4. Monitor webhook_health table for each workspace\n');

  return results;
}

async function main() {
  console.log('🚀 Workspace-Specific Webhook Setup\n');
  console.log('This script creates individual webhooks for each client workspace');
  console.log('using their workspace-specific API keys (no super admin fallback)\n');

  await createWorkspaceWebhooks();

  console.log('\n✨ Webhook setup complete!\n');
}

main().catch(console.error);
