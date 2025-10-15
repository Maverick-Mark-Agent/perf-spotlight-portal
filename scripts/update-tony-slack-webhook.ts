import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSlackWebhook() {
  console.log('=== UPDATE TONY SCHMITZ SLACK WEBHOOK URL ===\n');

  console.log('Current Slack Webhook URL:');
  const { data: current } = await supabase
    .from('client_registry')
    .select('slack_webhook_url')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  console.log(current?.slack_webhook_url);
  console.log('');

  // Get new webhook URL from command line argument
  const newWebhookUrl = process.argv[2];

  if (!newWebhookUrl) {
    console.log('❌ Please provide the new Slack webhook URL as an argument\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/update-tony-slack-webhook.ts "https://hooks.slack.com/services/YOUR/NEW/WEBHOOK"\n');
    console.log('To get a new Slack webhook URL:');
    console.log('1. Go to https://api.slack.com/apps');
    console.log('2. Create a new app or select existing app');
    console.log('3. Go to "Incoming Webhooks"');
    console.log('4. Enable webhooks and add to a channel');
    console.log('5. Copy the webhook URL');
    console.log('6. Run this script with that URL\n');
    return;
  }

  // Validate URL format
  if (!newWebhookUrl.startsWith('https://hooks.slack.com/services/')) {
    console.log('❌ Invalid Slack webhook URL format');
    console.log('Expected format: https://hooks.slack.com/services/...\n');
    return;
  }

  console.log('New Slack Webhook URL:');
  console.log(newWebhookUrl);
  console.log('');

  // Test the new webhook
  console.log('Testing new webhook URL...\n');

  const testMessage = {
    text: '✅ Slack webhook updated successfully!',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Slack Webhook Updated*\n\nTony Schmitz lead notifications are now configured for this channel.\n\nTime: ${new Date().toISOString()}`
        }
      }
    ]
  };

  try {
    const testResponse = await fetch(newWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    if (!testResponse.ok) {
      console.log(`❌ Test failed: ${testResponse.status} ${testResponse.statusText}`);
      console.log('The webhook URL is invalid or revoked\n');
      return;
    }

    console.log('✅ Test message sent successfully!\n');
    console.log('Check your Slack channel - you should see the test message.\n');

  } catch (error: any) {
    console.log(`❌ Error testing webhook: ${error.message}\n`);
    return;
  }

  // Update database
  console.log('Updating database...\n');

  const { error } = await supabase
    .from('client_registry')
    .update({ slack_webhook_url: newWebhookUrl })
    .eq('workspace_name', 'Tony Schmitz');

  if (error) {
    console.error('❌ Failed to update database:', error);
    return;
  }

  console.log('✅ Database updated successfully!\n');
  console.log('=== SETUP COMPLETE ===\n');
  console.log('Tony Schmitz lead notifications will now be sent to the new Slack channel.');
  console.log('Try marking a lead as interested in Email Bison to test it!\n');
}

updateSlackWebhook().catch(console.error);
