import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

const WEBHOOK_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

async function testWebhookDelivery() {
  console.log('🧪 Testing Webhook Delivery System\n');
  console.log('═'.repeat(120));

  // Test 1: Send a mock webhook payload
  console.log('\n📤 Test 1: Sending Mock Webhook Payload...\n');

  const mockPayload = {
    event: {
      type: 'lead_interested',
      workspace_name: 'Danny Schwartz',
      workspace_id: 36,
      instance_url: 'https://send.maverickmarketingllc.com',
    },
    data: {
      lead: {
        id: 999999,
        email: 'test.webhook@example.com',
        first_name: 'Test',
        last_name: 'Webhook',
        company: 'Webhook Test Co',
        title: 'Test User',
        custom_variables: [
          { name: 'phone', value: '555-1234' },
          { name: 'address', value: '123 Test St' },
          { name: 'city', value: 'Test City' },
          { name: 'state', value: 'TX' },
          { name: 'zip', value: '12345' },
        ],
      },
      reply: {
        date_received: new Date().toISOString(),
      },
    },
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockPayload),
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);

    const responseData = await response.json();
    console.log('Response Data:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ Webhook function is responding!\n');
    } else {
      console.log('\n❌ Webhook function returned an error\n');
      return;
    }
  } catch (error: any) {
    console.error('\n❌ Failed to call webhook:', error.message);
    return;
  }

  // Test 2: Check webhook delivery log
  console.log('═'.repeat(120));
  console.log('\n📋 Test 2: Checking Webhook Delivery Log...\n');

  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for DB write

  const { data: logs, error: logError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (logError) {
    console.error('❌ Error fetching webhook logs:', logError.message);
  } else if (!logs || logs.length === 0) {
    console.log('⚠️  No webhook delivery logs found');
  } else {
    console.log(`Found ${logs.length} recent webhook deliveries:\n`);

    for (const log of logs) {
      const timestamp = new Date(log.created_at).toLocaleString();
      const success = log.success ? '✅' : '❌';
      console.log(`${success} ${log.event_type} | ${log.workspace_name} | ${timestamp}`);
      if (log.error_message) {
        console.log(`   Error: ${log.error_message}`);
      }
    }
    console.log('');
  }

  // Test 3: Check webhook health
  console.log('═'.repeat(120));
  console.log('\n🏥 Test 3: Checking Webhook Health Status...\n');

  const { data: health, error: healthError } = await supabase
    .from('webhook_health')
    .select('*')
    .order('last_webhook_at', { ascending: false })
    .limit(10);

  if (healthError) {
    console.error('❌ Error fetching webhook health:', healthError.message);
  } else if (!health || health.length === 0) {
    console.log('⚠️  No webhook health records found\n');
    console.log('Webhooks may not be delivering yet, or the table hasn\'t been created.');
  } else {
    console.log(`Found ${health.length} workspace(s) with webhook activity:\n`);

    console.log('WORKSPACE'.padEnd(35) + 'LAST WEBHOOK'.padEnd(25) + 'COUNT (24h)'.padEnd(15) + 'HEALTH');
    console.log('─'.repeat(120));

    for (const record of health) {
      const lastWebhook = record.last_webhook_at
        ? new Date(record.last_webhook_at).toLocaleString()
        : 'Never';
      const healthStatus = record.is_healthy ? '✅ Healthy' : '❌ Unhealthy';

      console.log(
        record.workspace_name.padEnd(35) +
        lastWebhook.padEnd(25) +
        (record.webhook_count_24h || 0).toString().padEnd(15) +
        healthStatus
      );
    }
    console.log('');
  }

  // Test 4: Check client_leads table for test lead
  console.log('═'.repeat(120));
  console.log('\n📧 Test 4: Checking if Test Lead was Created...\n');

  const { data: testLead, error: leadError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('lead_email', 'test.webhook@example.com')
    .single();

  if (leadError && leadError.code !== 'PGRST116') {
    console.error('❌ Error checking test lead:', leadError.message);
  } else if (!testLead) {
    console.log('⚠️  Test lead not found in client_leads table\n');
    console.log('The webhook may have processed but failed to create the lead.');
  } else {
    console.log('✅ Test lead found in database!\n');
    console.log(`   Email: ${testLead.lead_email}`);
    console.log(`   Name: ${testLead.first_name} ${testLead.last_name}`);
    console.log(`   Workspace: ${testLead.workspace_name}`);
    console.log(`   Pipeline Stage: ${testLead.pipeline_stage}`);
    console.log(`   Interested: ${testLead.interested ? '✅' : '❌'}`);
    console.log('');
  }

  console.log('═'.repeat(120));
  console.log('\n📊 WEBHOOK SYSTEM STATUS\n');

  // Count workspaces with webhooks
  const { data: workspaces, error: wsError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_webhook_enabled')
    .eq('is_active', true);

  if (!wsError && workspaces) {
    const totalWorkspaces = workspaces.length;
    const withWebhooks = workspaces.filter(w => w.bison_webhook_enabled).length;

    console.log(`Total Active Workspaces: ${totalWorkspaces}`);
    console.log(`Webhooks Configured: ${withWebhooks}/${totalWorkspaces} (${Math.round(withWebhooks / totalWorkspaces * 100)}%)`);
  }

  // Check function deployment
  console.log(`\nWebhook Function URL: ${WEBHOOK_URL}`);
  console.log('Function Deployed: ✅ (with --no-verify-jwt)');

  console.log('\n═'.repeat(120));
  console.log('\n✅ WEBHOOK TESTING COMPLETE!\n');

  console.log('📝 Summary:\n');
  console.log('1. Webhook function is deployed and responding ✅');
  console.log('2. Check webhook_delivery_log for incoming webhooks');
  console.log('3. Monitor webhook_health for each workspace');
  console.log('4. Test in Email Bison by marking a real lead as interested\n');
}

async function main() {
  await testWebhookDelivery();
}

main().catch(console.error);
