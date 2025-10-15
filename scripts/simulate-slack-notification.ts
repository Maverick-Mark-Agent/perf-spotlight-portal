import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simulate what the webhook function does
async function simulateSlackNotification() {
  console.log('=== SIMULATING SLACK NOTIFICATION FLOW ===\n');

  // Get Tony's config
  const { data: client } = await supabase
    .from('client_registry')
    .select('slack_webhook_url')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (!client?.slack_webhook_url) {
    console.error('❌ No Slack webhook URL found');
    return;
  }

  console.log('✅ Slack webhook URL found');

  // Get the most recent lead
  const { data: lead } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lead) {
    console.error('❌ No lead found');
    return;
  }

  console.log(`✅ Lead found: ${lead.lead_email}`);

  // Helper to get custom variables
  const getCustomVar = (name: string) => {
    const variable = lead.custom_variables?.find((v: any) =>
      v.name?.toLowerCase() === name.toLowerCase() ||
      v.name?.toLowerCase().replace(' ', '_') === name.toLowerCase()
    );
    return variable?.value || 'N/A';
  };

  // Simulate building the message (without AI for now)
  const replyPreview = 'Test reply preview';
  const replyUrl = lead.bison_conversation_url;

  const slackMessage = {
    text: ':fire: New Lead!',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:fire: *New Lead!*
*Name:* ${lead.first_name || ''} ${lead.last_name || ''}
*Email:* ${lead.lead_email}
*Birthday:* ${getCustomVar('birthday')}
*Address:* ${getCustomVar('address')}
*City:* ${getCustomVar('city')}
*State:* ${getCustomVar('state')}
*ZIP:* ${getCustomVar('zip') || getCustomVar('zip code')}
*Renewal Date:* ${getCustomVar('renewal_date') || getCustomVar('renewal date')}
*Phone:* ${getCustomVar('phone')}

*Reply Preview:*
${replyPreview}`
        }
      },
      ...(replyUrl ? [
        {
          type: 'divider'
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Respond',
                emoji: true
              },
              url: replyUrl,
              action_id: 'respond_button'
            }
          ]
        }
      ] : [])
    ]
  };

  console.log('\n📤 Sending Slack message...\n');
  console.log(JSON.stringify(slackMessage, null, 2));

  try {
    const response = await fetch(client.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });

    console.log(`\nResponse Status: ${response.status}`);
    console.log(`Response Status Text: ${response.statusText}`);

    const responseText = await response.text();
    console.log(`Response Body: ${responseText}`);

    if (response.ok) {
      console.log('\n✅ Message would have been sent successfully!');
    } else {
      console.log('\n❌ Message would have failed');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

simulateSlackNotification().catch(console.error);
