// Comprehensive diagnosis of why Email Bison isn't sending webhooks

async function diagnoseWebhookFailure() {
  console.log('=== COMPREHENSIVE WEBHOOK FAILURE DIAGNOSIS ===\n');

  const apiKey = '95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525';
  const baseUrl = 'https://send.maverickmarketingllc.com/api';

  // 1. Check if the webhook is actually enabled
  console.log('1. Checking webhook status...\n');

  const response = await fetch(`${baseUrl}/webhook-url/112`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (response.ok) {
    const webhook = await response.json();
    console.log('Webhook Details:');
    console.log(JSON.stringify(webhook, null, 2));
    console.log('');
  } else {
    console.log(`Failed to fetch webhook details: ${response.status}`);
  }

  // 2. Check if there's a webhook delivery log in Email Bison
  console.log('\n2. Checking if Email Bison has delivery logs...\n');

  const deliveryEndpoints = [
    `${baseUrl}/webhook-url/112/deliveries`,
    `${baseUrl}/webhook-url/112/logs`,
    `${baseUrl}/webhook-deliveries`,
  ];

  for (const endpoint of deliveryEndpoints) {
    console.log(`Trying: ${endpoint}`);
    try {
      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });
      console.log(`  Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log('  ✅ Found delivery logs!');
        console.log(JSON.stringify(data, null, 2));
        break;
      }
    } catch (error: any) {
      console.log(`  Error: ${error.message}`);
    }
  }

  console.log('\n\n3. CRITICAL FINDINGS:\n');
  console.log('Based on the evidence:');
  console.log('- Webhook #112 IS registered in Email Bison');
  console.log('- Yesterday, webhook #86 was receiving events (11 webhooks)');
  console.log('- Today, after deleting #86, NO webhooks are coming through');
  console.log('- Webhook #112 was created Oct 10, but may not have been active');
  console.log('\nPOSSIBLE ROOT CAUSES:\n');
  console.log('A. Email Bison has TWO different webhook systems:');
  console.log('   - OLD system (webhook #86) - was working');
  console.log('   - NEW system (webhook #112) - not triggering');
  console.log('');
  console.log('B. The workspace API key might not have permission for webhooks');
  console.log('');
  console.log('C. There might be a webhook toggle/enable setting in Email Bison UI');
  console.log('');
  console.log('D. Email Bison might be experiencing downtime/issues');
  console.log('');
  console.log('\nRECOMMENDED ACTIONS:\n');
  console.log('1. Check Email Bison UI for webhook settings/toggles');
  console.log('2. Look for any "Enable Webhooks" or "Active" toggle');
  console.log('3. Check if there\'s a webhook delivery log in Email Bison dashboard');
  console.log('4. Try deleting and re-creating the webhook');
  console.log('5. Contact Email Bison support if issue persists');
}

diagnoseWebhookFailure().catch(console.error);
