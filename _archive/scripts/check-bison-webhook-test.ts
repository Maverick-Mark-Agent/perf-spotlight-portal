// Check if Email Bison has a webhook test feature

async function checkBisonWebhookTest() {
  console.log('=== CHECKING EMAIL BISON WEBHOOK TEST CAPABILITY ===\n');

  const apiKey = '95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525';
  const baseUrl = 'https://send.maverickmarketingllc.com/api';
  const webhookId = 112;

  console.log('Attempting to trigger test webhook from Email Bison...\n');

  // Try to trigger a test webhook
  const testEndpoints = [
    { method: 'POST', url: `${baseUrl}/webhook-url/${webhookId}/test` },
    { method: 'POST', url: `${baseUrl}/webhook-url/${webhookId}/trigger` },
    { method: 'GET', url: `${baseUrl}/webhook-url/${webhookId}/test` },
  ];

  for (const endpoint of testEndpoints) {
    console.log(`Trying ${endpoint.method} ${endpoint.url}...`);

    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      console.log(`  Status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log('  ✅ SUCCESS!');
        console.log('  Response:', JSON.stringify(data, null, 2));
        console.log('\n  Check your Slack channel and webhook_delivery_log!\n');
        return;
      } else if (response.status !== 404 && response.status !== 405) {
        const text = await response.text();
        console.log(`  Response: ${text.substring(0, 200)}`);
      }
    } catch (error: any) {
      console.log(`  Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('❌ No test endpoint found\n');
  console.log('=== ALTERNATIVE: CHECK EMAIL BISON UI ===\n');
  console.log('In the Email Bison dashboard:');
  console.log('1. Go to Settings → Integrations → Webhooks');
  console.log('2. Look for webhook ID 112');
  console.log('3. Check if there\'s a "Test" or "Send Test Event" button');
  console.log('4. Check if there\'s a "Delivery Log" or "Recent Deliveries" section\n');
  console.log('This will show you if Email Bison is even attempting to send webhooks.');
}

checkBisonWebhookTest().catch(console.error);
