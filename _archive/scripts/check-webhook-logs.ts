import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

// The contacts that didn't come through webhooks
const targetEmails = [
  'benjaminhkirsch@gmail.com',
  'kinderteacher@comcast.net',
  'charleneturenne@gmail.com',
  'sankar.stmt@gmail.com',
  'bcsavage4@yahoo.com',
  'rvalverde1515@gmail.com',
  'pattt2u@gmail.com',
  'jstuemky856@gmail.com',
  'tgrabski@comcast.net',
  'msdee665@comcast.net',
];

const workspaceNames = [
  'STREETSMART COMMERCIAL',
  'ROB Russell',
  'NICK SAKHA',
  'Kirk hodgson',
  'John Roberts',
  'Jason Binyon',
  'David Amiri',
  'Danny Schwartz',
];

async function checkWebhookLogs() {
  console.log('🔍 Checking Webhook Delivery Logs\n');
  console.log('═'.repeat(120));

  // Check if webhook_delivery_log table exists
  const { data: tables, error: tableError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .limit(1);

  if (tableError) {
    console.log('❌ webhook_delivery_log table does not exist or is not accessible');
    console.log('   Error:', tableError.message);
    console.log('\n⚠️  This explains why webhooks didn\'t work - the logging infrastructure may not be set up.');
    return;
  }

  console.log('✅ webhook_delivery_log table exists\n');

  // Check for recent interested lead webhooks
  console.log('📊 Recent "lead_interested" webhook deliveries:\n');

  const { data: recentWebhooks, error: webhookError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('event_type', 'lead_interested')
    .order('created_at', { ascending: false })
    .limit(50);

  if (webhookError) {
    console.error('❌ Error fetching webhooks:', webhookError);
    return;
  }

  if (!recentWebhooks || recentWebhooks.length === 0) {
    console.log('⚠️  No "lead_interested" webhook deliveries found in the last 50 records');
    console.log('   This suggests webhooks may not be firing for interested leads.\n');
  } else {
    console.log(`Found ${recentWebhooks.length} recent "lead_interested" webhook deliveries\n`);

    // Check for our specific emails
    let foundCount = 0;
    for (const webhook of recentWebhooks) {
      const payload = webhook.payload;
      const leadEmail = payload?.data?.lead?.email?.toLowerCase();

      if (leadEmail && targetEmails.some(e => e.toLowerCase() === leadEmail)) {
        foundCount++;
        console.log(`✅ Found webhook for: ${leadEmail}`);
        console.log(`   Workspace: ${webhook.workspace_name}`);
        console.log(`   Success: ${webhook.success ? '✅' : '❌'}`);
        console.log(`   Date: ${webhook.created_at}`);
        if (webhook.error_message) {
          console.log(`   Error: ${webhook.error_message}`);
        }
        console.log('');
      }
    }

    if (foundCount === 0) {
      console.log('❌ None of our 10 target emails were found in recent webhook logs');
      console.log('   This means the webhooks never fired for these leads.\n');
    } else {
      console.log(`📊 Summary: Found ${foundCount}/${targetEmails.length} emails in webhook logs\n`);
    }
  }

  // Check webhook health for our workspaces
  console.log('═'.repeat(120));
  console.log('🏥 Webhook Health Status for Target Workspaces:\n');

  const { data: healthRecords, error: healthError } = await supabase
    .from('webhook_health')
    .select('*')
    .in('workspace_name', workspaceNames);

  if (healthError) {
    console.log('⚠️  webhook_health table does not exist or is not accessible');
    console.log('   Error:', healthError.message);
  } else if (!healthRecords || healthRecords.length === 0) {
    console.log('⚠️  No webhook health records found for target workspaces');
    console.log('   This suggests webhooks have never fired for these clients.\n');
  } else {
    console.log('WORKSPACE'.padEnd(35) + 'LAST WEBHOOK'.padEnd(25) + 'COUNT (24h)'.padEnd(15) + 'HEALTH');
    console.log('═'.repeat(120));

    for (const health of healthRecords) {
      const lastWebhook = health.last_webhook_at
        ? new Date(health.last_webhook_at).toLocaleString()
        : 'Never';
      const count = health.webhook_count_24h || 0;
      const healthStatus = health.is_healthy ? '✅ Healthy' : '❌ Unhealthy';

      console.log(
        health.workspace_name.padEnd(35) +
        lastWebhook.padEnd(25) +
        count.toString().padEnd(15) +
        healthStatus
      );

      if (health.last_error_message) {
        console.log(`  └─ Error: ${health.last_error_message}`);
      }
    }
  }

  // Check client registry for webhook configuration
  console.log('\n═'.repeat(120));
  console.log('⚙️  Client Registry Webhook Configuration:\n');

  const { data: clients, error: clientError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_interested_webhook_id, is_active')
    .in('workspace_name', workspaceNames);

  if (clientError) {
    console.error('❌ Error fetching client registry:', clientError);
  } else if (!clients || clients.length === 0) {
    console.log('⚠️  No matching clients found in registry');
  } else {
    console.log('WORKSPACE'.padEnd(35) + 'WEBHOOK ID'.padEnd(15) + 'ACTIVE'.padEnd(10));
    console.log('═'.repeat(120));

    for (const client of clients) {
      const webhookId = client.bison_interested_webhook_id || 'Not set';
      const active = client.is_active ? '✅' : '❌';

      console.log(
        client.workspace_name.padEnd(35) +
        webhookId.toString().padEnd(15) +
        active
      );
    }
  }

  console.log('\n═'.repeat(120));
}

async function diagnoseIssue() {
  console.log('\n\n🔬 WEBHOOK FAILURE DIAGNOSIS\n');
  console.log('═'.repeat(120));

  const issues = [];

  // Check if universal webhook is being used
  console.log('Checking webhook configuration...\n');

  const { data: logs, error: logError } = await supabase
    .from('webhook_delivery_log')
    .select('event_type, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (logError || !logs || logs.length === 0) {
    issues.push({
      severity: '🔴 CRITICAL',
      issue: 'No webhook deliveries recorded',
      explanation: 'The webhook_delivery_log table is empty or not accessible. This means webhooks are either not configured or not being logged.',
      solution: 'Check if the universal-bison-webhook function is deployed and if Email Bison webhooks are pointing to it.',
    });
  }

  // Check for recent activity
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { data: recentLogs, error: recentError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .gte('created_at', oneDayAgo.toISOString());

  if (!recentError && (!recentLogs || recentLogs.length === 0)) {
    issues.push({
      severity: '🟡 WARNING',
      issue: 'No webhook activity in last 24 hours',
      explanation: 'No webhooks have been received in the past day. This could indicate a configuration issue or no leads have been marked as interested.',
      solution: 'Test by manually marking a lead as interested in Email Bison and checking if the webhook fires.',
    });
  }

  // Display findings
  if (issues.length === 0) {
    console.log('✅ No obvious configuration issues detected.\n');
    console.log('Possible reasons for missing contacts:');
    console.log('  1. The leads were marked as interested before the webhook was configured');
    console.log('  2. There was a temporary webhook outage when these leads came in');
    console.log('  3. The webhook fired but failed to process (check error logs)');
    console.log('  4. The leads were marked interested in a different workspace');
  } else {
    console.log('Found the following issues:\n');

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      console.log(`${i + 1}. ${issue.severity} ${issue.issue}`);
      console.log(`   └─ ${issue.explanation}`);
      console.log(`   └─ Solution: ${issue.solution}\n`);
    }
  }

  console.log('═'.repeat(120));
}

async function main() {
  console.log('🚀 Webhook Failure Investigation\n');
  console.log('Investigating why 10 contacts did not sync via webhooks\n');

  await checkWebhookLogs();
  await diagnoseIssue();

  console.log('\n✨ Investigation complete!\n');
}

main().catch(console.error);
