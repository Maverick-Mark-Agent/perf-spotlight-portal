import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function compareWebhookUrls() {
  console.log('=== WEBHOOK URL COMPARISON ===\n');

  const docUrl = 'https://hooks.slack.com/services/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';

  // Get current webhook URL from database
  const { data: client } = await supabase
    .from('client_registry')
    .select('slack_webhook_url, updated_at')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (!client) {
    console.log('❌ Tony Schmitz not found in database');
    return;
  }

  const dbUrl = client.slack_webhook_url;

  console.log('Documentation URL (TEST):');
  console.log(`  ${docUrl}`);
  console.log('\nDatabase URL (CURRENT):');
  console.log(`  ${dbUrl}`);
  console.log(`\nLast Updated: ${client.updated_at}`);

  if (docUrl === dbUrl) {
    console.log('\n✅ URLs match - using TEST webhook');
  } else {
    console.log('\n⚠️  URLs DO NOT match!');
    console.log('\nThis means the webhook URL was changed from the TEST URL to a different URL.');
    console.log('Notifications are being sent to the CURRENT database URL, not the TEST URL in docs.');
  }

  // Test both URLs
  console.log('\n\n=== TESTING BOTH WEBHOOKS ===\n');

  const testMessage = {
    text: '🧪 Webhook Comparison Test',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🧪 *Webhook Comparison Test*\n\nTesting webhook delivery at ${new Date().toISOString()}`
        }
      }
    ]
  };

  // Test doc URL
  console.log('1. Testing DOCUMENTATION (TEST) URL...');
  try {
    const docResponse = await fetch(docUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...testMessage, text: testMessage.text + ' - DOC URL' })
    });
    console.log(`   Status: ${docResponse.status} - ${docResponse.statusText}`);
    if (docResponse.ok) {
      console.log('   ✅ DOC webhook is working');
    } else {
      console.log('   ❌ DOC webhook failed (might be revoked)');
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test database URL
  console.log('\n2. Testing DATABASE (CURRENT) URL...');
  try {
    const dbResponse = await fetch(dbUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...testMessage, text: testMessage.text + ' - DB URL' })
    });
    console.log(`   Status: ${dbResponse.status} - ${dbResponse.statusText}`);
    if (dbResponse.ok) {
      console.log('   ✅ DATABASE webhook is working');
    } else {
      console.log('   ❌ DATABASE webhook failed');
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('\n\n=== CONCLUSION ===');
  console.log('Check both Slack channels to see which one(s) received the test messages.');
  console.log('The notifications are currently being sent to the DATABASE URL channel.');
}

compareWebhookUrls().catch(console.error);
