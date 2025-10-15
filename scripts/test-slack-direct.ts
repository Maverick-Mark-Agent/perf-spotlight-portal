import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSlackDirect() {
  console.log('=== DIRECT SLACK NOTIFICATION TEST ===\n');

  // Get Tony's Slack webhook URL
  const { data: client } = await supabase
    .from('client_registry')
    .select('slack_webhook_url')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (!client?.slack_webhook_url) {
    console.error('❌ No Slack webhook URL configured');
    return;
  }

  console.log('Slack Webhook URL:');
  console.log(client.slack_webhook_url);
  console.log('');

  // Send a very simple test message
  const simpleMessage = {
    text: '🔔 TEST NOTIFICATION from Claude - ' + new Date().toLocaleTimeString(),
  };

  console.log('Sending simple test message...\n');

  try {
    const response = await fetch(client.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simpleMessage)
    });

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Text: ${await response.text()}`);

    if (response.ok) {
      console.log('\n✅ Message sent successfully!');
      console.log('\nIf you don\'t see this in Slack, possible issues:');
      console.log('1. You\'re looking at the wrong Slack workspace');
      console.log('2. You\'re looking at the wrong channel');
      console.log('3. The webhook was revoked/deleted in Slack');
      console.log('4. Notifications are muted for that channel');
      console.log('\nThe webhook URL points to workspace: T06R9MD2U2W');
      console.log('Channel ID: B09L98CE9UJ');
    } else {
      console.log('\n❌ Failed to send message');
      console.log('The Slack webhook URL might be invalid or revoked');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  // Also check if OpenAI API key might be causing issues in the edge function
  console.log('\n\n=== CHECKING EDGE FUNCTION CONFIGURATION ===');
  console.log('\nNote: The edge function uses OpenAI to clean reply text.');
  console.log('If OpenAI API key is missing, it falls back to raw text.');
  console.log('This should NOT prevent Slack notifications, but may affect formatting.\n');
}

testSlackDirect().catch(console.error);
