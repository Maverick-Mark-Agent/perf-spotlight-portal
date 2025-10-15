// Check if Tony Schmitz's webhook is registered in Email Bison

async function checkTonyWebhook() {
  console.log('=== CHECKING TONY SCHMITZ WEBHOOK REGISTRATION IN EMAIL BISON ===\n');

  const apiKey = '95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525';
  const baseUrl = 'https://send.maverickmarketingllc.com/api';
  const expectedWebhookUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

  console.log('Fetching registered webhooks...\n');

  try {
    const response = await fetch(`${baseUrl}/webhook-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch webhooks:');
      console.error(errorText);
      return;
    }

    const data = await response.json();
    console.log('Response:');
    console.log(JSON.stringify(data, null, 2));

    const webhooks = data.data || [];

    if (webhooks.length === 0) {
      console.log('\n❌ NO WEBHOOKS REGISTERED!');
      console.log('\nThis is why notifications are not being sent.');
      console.log('Tony Schmitz workspace has NO webhook registered in Email Bison.');
      return;
    }

    console.log(`\n✅ Found ${webhooks.length} webhook(s):\n`);

    webhooks.forEach((webhook: any, i: number) => {
      console.log(`${i + 1}. Webhook ID: ${webhook.id}`);
      console.log(`   Name: ${webhook.name || 'N/A'}`);
      console.log(`   URL: ${webhook.url}`);
      console.log(`   Events: ${Array.isArray(webhook.events) ? webhook.events.join(', ') : 'N/A'}`);
      console.log(`   Status: ${webhook.status || 'N/A'}`);
      console.log('');
    });

    // Check if our webhook exists
    const ourWebhook = webhooks.find((w: any) =>
      w.url?.includes('gjqbbgrfhijescaouqkx') ||
      w.url?.includes('universal-bison-webhook')
    );

    if (ourWebhook) {
      console.log('✅ OUR WEBHOOK IS REGISTERED!');
      console.log(`   ID: ${ourWebhook.id}`);
      console.log(`   URL: ${ourWebhook.url}`);
      console.log(`   Events: ${ourWebhook.events?.join(', ')}`);

      // Check if lead_interested is enabled
      const hasLeadInterested = ourWebhook.events?.some((e: string) =>
        e.toLowerCase() === 'lead_interested'
      );

      if (hasLeadInterested) {
        console.log('\n✅ lead_interested event IS enabled');
        console.log('\nThe webhook configuration looks correct!');
        console.log('If notifications are not coming through, the issue might be:');
        console.log('1. OpenAI API key not set in Supabase Edge Function secrets');
        console.log('2. The Slack webhook URL changed');
        console.log('3. The lead was not actually marked as "interested" in Email Bison');
      } else {
        console.log('\n❌ lead_interested event is NOT enabled!');
        console.log('This is the problem - the webhook will not fire for interested leads.');
      }
    } else {
      console.log('❌ OUR WEBHOOK IS NOT REGISTERED!');
      console.log('\nThis is the problem - Tony Schmitz workspace does not have our webhook registered.');
      console.log('\nRegistered webhooks are pointing to:');
      webhooks.forEach((w: any) => console.log(`   - ${w.url}`));
      console.log(`\nBut we expected: ${expectedWebhookUrl}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkTonyWebhook().catch(console.error);
