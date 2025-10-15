// This script triggers the actual webhook function to test end-to-end

async function triggerWebhook() {
  console.log('=== TRIGGERING TEST WEBHOOK ===\n');

  const webhookUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

  // Create a test payload that matches what Email Bison sends
  const testPayload = {
    event: {
      type: 'LEAD_INTERESTED',
      workspace_name: 'Tony Schmitz',
      workspace_id: 41,
      instance_url: 'https://send.maverickmarketingllc.com'
    },
    data: {
      lead: {
        id: 99999,
        email: 'test-lead-' + Date.now() + '@example.com',
        first_name: 'Test',
        last_name: 'Lead',
        company: 'Test Company',
        title: 'Test Title',
        custom_variables: [
          { name: 'birthday', value: '1/1/1990' },
          { name: 'address', value: '123 Test St' },
          { name: 'city', value: 'Test City' },
          { name: 'state', value: 'TS' },
          { name: 'zip code', value: '12345' },
          { name: 'renewal date', value: 'December 15th' },
          { name: 'phone', value: '(555) 123-4567' }
        ]
      },
      reply: {
        uuid: 'test-uuid-' + Date.now(),
        date_received: new Date().toISOString(),
        text_body: 'Yes, I am interested in getting a quote. Please send me more information.',
        body_plain: 'Yes, I am interested in getting a quote. Please send me more information.'
      }
    }
  };

  console.log('Payload:');
  console.log(JSON.stringify(testPayload, null, 2));

  console.log('\n📤 Sending webhook...\n');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Status Text: ${response.statusText}`);

    const responseData = await response.json();
    console.log('\nResponse Data:');
    console.log(JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ Webhook processed successfully!');
      console.log('\n📱 Check your Slack channel - you should see a test notification!');
    } else {
      console.log('\n❌ Webhook failed');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

triggerWebhook().catch(console.error);
