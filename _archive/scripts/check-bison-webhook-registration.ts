// Check if webhook is registered in Email Bison for Tony Schmitz workspace

async function checkBisonWebhookRegistration() {
  console.log('=== CHECKING EMAIL BISON WEBHOOK REGISTRATION ===\n');

  const apiKey = '95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525';
  const bisonUrl = 'https://send.maverickmarketingllc.com/api';

  // 1. Check workspace webhooks
  console.log('1. Checking registered webhooks for workspace 41 (Tony Schmitz)...\n');

  try {
    const response = await fetch(`${bisonUrl}/workspaces/v1.1/webhooks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch webhooks: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log('Registered webhooks:');
    console.log(JSON.stringify(data, null, 2));

    // Check if our webhook URL is registered
    const expectedUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

    if (data.data && Array.isArray(data.data)) {
      const ourWebhook = data.data.find((w: any) => w.url === expectedUrl);

      if (ourWebhook) {
        console.log('\n✅ Our webhook URL IS registered!');
        console.log('Webhook details:');
        console.log(JSON.stringify(ourWebhook, null, 2));

        // Check if lead_interested event is enabled
        const hasLeadInterested = ourWebhook.events?.includes('lead_interested') ||
                                  ourWebhook.events?.includes('LEAD_INTERESTED');

        if (hasLeadInterested) {
          console.log('\n✅ lead_interested event IS enabled');
        } else {
          console.log('\n❌ lead_interested event is NOT enabled');
          console.log('Enabled events:', ourWebhook.events);
        }
      } else {
        console.log('\n❌ Our webhook URL is NOT registered!');
        console.log(`Expected: ${expectedUrl}`);
        console.log('\nRegistered webhooks:');
        data.data.forEach((w: any, i: number) => {
          console.log(`  ${i + 1}. ${w.url}`);
          console.log(`     Events: ${w.events?.join(', ')}`);
        });
      }
    } else {
      console.log('\n⚠️  No webhooks registered or unexpected response format');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkBisonWebhookRegistration().catch(console.error);
