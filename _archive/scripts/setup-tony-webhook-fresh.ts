import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TONY_SLACK_WEBHOOK = 'https://hooks.slack.com/services/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';

async function setupTonyWebhook() {
  console.log('=== SETTING UP TONY SCHMITZ WEBHOOK FROM SCRATCH ===\n');

  // Step 1: Update client_registry with Slack webhook URL
  console.log('Step 1: Updating client_registry with Slack webhook URL...');
  const { error: updateError } = await supabase
    .from('client_registry')
    .update({
      slack_webhook_url: TONY_SLACK_WEBHOOK,
      bison_webhook_url: 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook',
      bison_webhook_enabled: true,
      bison_webhook_events: ['lead_interested']
    })
    .eq('workspace_name', 'Tony Schmitz');

  if (updateError) {
    console.error('❌ Error updating client_registry:', updateError);
    return;
  }

  console.log('✅ client_registry updated with Slack webhook URL\n');

  // Step 2: Get Tony's API key
  console.log('Step 2: Getting Tony\'s Email Bison API key...');
  const { data: client, error: clientError } = await supabase
    .from('client_registry')
    .select('bison_api_key, bison_workspace_id, workspace_name')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (clientError || !client?.bison_api_key) {
    console.error('❌ Error getting API key:', clientError);
    return;
  }

  console.log(`✅ Workspace: ${client.workspace_name}`);
  console.log(`✅ Workspace ID: ${client.bison_workspace_id}`);
  console.log(`✅ API Key: ${client.bison_api_key.substring(0, 10)}...\n`);

  // Step 3: Delete old webhook #114 if it exists
  console.log('Step 3: Checking for existing webhooks...');
  const listResponse = await fetch('https://send.maverickmarketingllc.com/api/webhook-url', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${client.bison_api_key}`,
      'Content-Type': 'application/json'
    }
  });

  const existingWebhooks = await listResponse.json();
  console.log('Current webhooks:', JSON.stringify(existingWebhooks, null, 2));

  // Delete webhook #114 if it exists
  const webhook114 = existingWebhooks.data?.find((w: any) => w.id === 114);
  if (webhook114) {
    console.log('\nDeleting old webhook #114...');
    const deleteResponse = await fetch('https://send.maverickmarketingllc.com/api/webhook-url/114', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${client.bison_api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (deleteResponse.ok) {
      console.log('✅ Webhook #114 deleted');
    } else {
      console.log('⚠️ Could not delete webhook #114 (may not exist)');
    }

    // Wait for cache to clear
    console.log('Waiting 45 seconds for Email Bison cache to clear...');
    await new Promise(resolve => setTimeout(resolve, 45000));
  } else {
    console.log('No webhook #114 found, skipping deletion\n');
  }

  // Step 4: Create fresh webhook
  console.log('Step 4: Creating fresh webhook in Email Bison...');
  const createResponse = await fetch('https://send.maverickmarketingllc.com/api/webhook-url', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${client.bison_api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Tony Schmitz - Lead Notifications (Fresh Setup)',
      url: 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook',
      events: ['lead_interested']
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('❌ Error creating webhook:', errorText);
    return;
  }

  const newWebhook = await createResponse.json();
  console.log('✅ New webhook created:');
  console.log(JSON.stringify(newWebhook, null, 2));

  // Step 5: Verify webhook registration
  console.log('\nStep 5: Verifying webhook registration...');
  const verifyResponse = await fetch('https://send.maverickmarketingllc.com/api/webhook-url', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${client.bison_api_key}`,
      'Content-Type': 'application/json'
    }
  });

  const allWebhooks = await verifyResponse.json();
  console.log('All registered webhooks:');
  console.log(JSON.stringify(allWebhooks, null, 2));

  console.log('\n=== SETUP COMPLETE ===');
  console.log(`✅ Slack webhook URL: ${TONY_SLACK_WEBHOOK}`);
  console.log(`✅ Email Bison webhook: Created (ID: ${newWebhook.id})`);
  console.log(`✅ Database configured: client_registry updated`);
  console.log('\n📋 NEXT STEP: Test with a real lead in Email Bison');
  console.log('Mark a BRAND NEW lead as interested and check:');
  console.log('1. Slack channel for notification');
  console.log('2. Database for lead entry');
  console.log('3. Client Portal for lead display');
}

setupTonyWebhook().catch(console.error);
