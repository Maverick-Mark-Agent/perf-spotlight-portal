import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TONY_SLACK_WEBHOOK = 'https://hooks.slack.com/services/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';

async function testSlackNotification() {
  console.log('=== TESTING TONY SLACK NOTIFICATION ===\n');

  // Create a test lead payload matching the actual format
  const testLead = {
    first_name: 'Test',
    last_name: 'Contact',
    email: 'test@example.com',
    custom_variables: [
      { name: 'birthday', value: '1/1/1980' },
      { name: 'address', value: '123 Test Street' },
      { name: 'city', value: 'Omaha' },
      { name: 'state', value: 'NE' },
      { name: 'zip', value: '68104' },
      { name: 'renewal_date', value: 'November 15th' },
      { name: 'phone', value: '(402) 555-1234' }
    ]
  };

  const testReply = {
    text_body: 'Yes, I am very interested in getting a quote for home insurance. Please call me at your earliest convenience.',
    uuid: 'test-uuid-' + Date.now()
  };

  // Extract custom variables helper
  const getCustomVar = (name: string) => {
    const variable = testLead.custom_variables?.find((v: any) =>
      v.name?.toLowerCase() === name.toLowerCase()
    );
    return variable?.value || 'N/A';
  };

  // Build the reply URL
  const replyUrl = `https://send.maverickmarketingllc.com/inbox?reply_uuid=${testReply.uuid}`;

  // Simulate OpenAI cleaned reply
  const replyPreview = 'Yes, I am very interested in getting a quote for home insurance. Please call me at your earliest convenience.';

  // Build the exact Slack message format from universal-bison-webhook
  const slackMessage = {
    text: ':fire: New Lead!',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:fire: *New Lead!*\n*Name:* ${testLead.first_name || ''} ${testLead.last_name || ''}\n*Email:* ${testLead.email}\n*Birthday:* ${getCustomVar('birthday')}\n*Address:* ${getCustomVar('address')}\n*City:* ${getCustomVar('city')}\n*State:* ${getCustomVar('state')}\n*ZIP:* ${getCustomVar('zip')}\n*Renewal Date:* ${getCustomVar('renewal_date')}\n*Phone:* ${getCustomVar('phone')}\n\n*Reply Preview:*\n${replyPreview}`
        }
      },
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
    ]
  };

  console.log('Sending test notification to Slack...');
  console.log('Webhook URL:', TONY_SLACK_WEBHOOK);
  console.log('\nMessage payload:');
  console.log(JSON.stringify(slackMessage, null, 2));

  try {
    const response = await fetch(TONY_SLACK_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });

    const responseText = await response.text();

    console.log('\n=== SLACK RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Response:', responseText);

    if (response.ok && responseText === 'ok') {
      console.log('\n✅ SUCCESS! Test notification sent to Slack!');
      console.log('Check your Slack channel for the test message.');
    } else {
      console.log('\n❌ FAILED! Slack did not accept the notification.');
      console.log('Possible issues:');
      console.log('1. Webhook URL may be invalid or revoked');
      console.log('2. Slack app may not have permissions');
      console.log('3. Channel may have been deleted');
      console.log('\nYou may need to regenerate the Slack webhook URL.');
    }
  } catch (error: any) {
    console.error('\n❌ ERROR sending to Slack:', error.message);
  }
}

testSlackNotification().catch(console.error);
