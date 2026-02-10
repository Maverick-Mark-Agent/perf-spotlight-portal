// Check Email Bison webhook registration with correct endpoint

async function checkWebhooks() {
  console.log('=== CHECKING EMAIL BISON WEBHOOKS ===\n');

  const apiKey = '95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525';
  const workspaceId = 41;

  // Try different endpoint variations
  const endpoints = [
    `https://send.maverickmarketingllc.com/api/v1/workspaces/${workspaceId}/webhooks`,
    `https://send.maverickmarketingllc.com/api/v1/webhooks`,
    `https://send.maverickmarketingllc.com/api/webhooks`,
    `https://send.maverickmarketingllc.com/api/v1.1/workspaces/${workspaceId}/webhooks`,
  ];

  for (const endpoint of endpoints) {
    console.log(`Trying: ${endpoint}`);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      });

      console.log(`  Status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log('\n✅ SUCCESS! Found webhooks:');
        console.log(JSON.stringify(data, null, 2));

        // Check for our webhook
        const expectedUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

        if (data.data && Array.isArray(data.data)) {
          const ourWebhook = data.data.find((w: any) =>
            w.url?.includes('gjqbbgrfhijescaouqkx') ||
            w.url?.includes('universal-bison-webhook')
          );

          if (ourWebhook) {
            console.log('\n✅ Our webhook found:');
            console.log(JSON.stringify(ourWebhook, null, 2));
          } else {
            console.log('\n❌ Our webhook NOT found in registered webhooks');
          }
        }

        return;
      } else {
        const text = await response.text();
        console.log(`  Response: ${text.substring(0, 100)}`);
      }
    } catch (error: any) {
      console.log(`  Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('❌ Could not find the correct webhook endpoint');
  console.log('\nLet me check workspace info instead...\n');

  // Try to get workspace info
  try {
    const wsResponse = await fetch(`https://send.maverickmarketingllc.com/api/v1/workspaces/${workspaceId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    console.log(`Workspace info status: ${wsResponse.status}`);
    if (wsResponse.ok) {
      const wsData = await wsResponse.json();
      console.log('Workspace data:');
      console.log(JSON.stringify(wsData, null, 2));
    }
  } catch (error: any) {
    console.log(`Workspace check error: ${error.message}`);
  }
}

checkWebhooks().catch(console.error);
