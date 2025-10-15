// Delete and recreate the webhook to force Email Bison to recognize it

async function recreateWebhook() {
  console.log('=== RECREATING WEBHOOK FOR TONY SCHMITZ ===\n');

  const apiKey = '95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525';
  const baseUrl = 'https://send.maverickmarketingllc.com/api';
  const webhookUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

  // Step 1: Delete existing webhook #112
  console.log('Step 1: Deleting existing webhook #112...\n');

  const deleteResponse = await fetch(`${baseUrl}/webhook-url/112`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (deleteResponse.ok) {
    console.log('✅ Webhook #112 deleted successfully\n');
  } else {
    console.log(`⚠️  Delete returned: ${deleteResponse.status}\n`);
  }

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Create new webhook
  console.log('Step 2: Creating new webhook...\n');

  const createResponse = await fetch(`${baseUrl}/webhook-url`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Tony Schmitz - Lead Notifications',
      url: webhookUrl,
      events: ['lead_interested'],
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error(`❌ Failed to create webhook: ${createResponse.status}`);
    console.error(errorText);
    return;
  }

  const newWebhook = await createResponse.json();
  console.log('✅ New webhook created successfully!\n');
  console.log('Webhook Details:');
  console.log(JSON.stringify(newWebhook, null, 2));

  console.log('\n\n=== NEXT STEPS ===\n');
  console.log('1. Try marking a NEW lead as interested in Email Bison');
  console.log('2. Check for webhook in database:');
  console.log('   npx tsx scripts/check-latest-webhook.ts');
  console.log('3. Check Slack for notification');
  console.log('\nIf it still doesn\'t work after this, the issue is likely:');
  console.log('- Email Bison webhook feature might be disabled for this workspace');
  console.log('- Need to check Email Bison dashboard for webhook settings');
  console.log('- Contact Email Bison support');
}

recreateWebhook().catch(console.error);
