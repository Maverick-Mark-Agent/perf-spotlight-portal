import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSlackWebhook() {
  console.log('=== TESTING TONY SCHMITZ SLACK WEBHOOK ===\n');

  // 1. Get Tony's webhook URL
  const { data: client } = await supabase
    .from('client_registry')
    .select('workspace_name, slack_webhook_url')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (!client?.slack_webhook_url) {
    console.error('❌ No Slack webhook URL found for Tony Schmitz');
    return;
  }

  console.log('Webhook URL found:', client.slack_webhook_url);

  // 2. Send a test message directly to Slack
  const testMessage = {
    text: '🧪 Test Message from Claude',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🧪 *Test Message from Claude*\n\nThis is a test to verify the Slack webhook is working.\n\nTime: ${new Date().toISOString()}`
        }
      }
    ]
  };

  console.log('\nSending test message to Slack...\n');

  try {
    const response = await fetch(client.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    console.log('Response status:', response.status);
    console.log('Response status text:', response.statusText);

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (response.ok) {
      console.log('\n✅ Test message sent successfully!');
      console.log('Check your Slack channel for the message.');
    } else {
      console.log('\n❌ Failed to send test message');
      console.log('This might indicate the webhook URL is invalid or revoked');
    }
  } catch (error) {
    console.error('\n❌ Error sending message:', error);
  }

  // 3. Check the most recent lead to see what should have been sent
  console.log('\n\n=== CHECKING MOST RECENT LEAD ===\n');

  const { data: lead } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lead) {
    console.log('Most recent lead:');
    console.log(`  Name: ${lead.first_name} ${lead.last_name}`);
    console.log(`  Email: ${lead.lead_email}`);
    console.log(`  Received: ${lead.date_received}`);
    console.log(`  Stage: ${lead.pipeline_stage}`);

    if (lead.custom_variables) {
      console.log('\n  Custom Variables:');
      lead.custom_variables.forEach((cv: any) => {
        console.log(`    ${cv.name}: ${cv.value}`);
      });
    }
  }
}

testSlackWebhook().catch(console.error);
