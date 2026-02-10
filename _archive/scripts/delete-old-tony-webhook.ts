// Delete the old bison-interested-webhook for Tony Schmitz
// Keep only the universal-bison-webhook which has Slack notification support

async function deleteOldWebhook() {
  console.log('=== DELETING OLD WEBHOOK FOR TONY SCHMITZ ===\n');

  const apiKey = '95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525';
  const baseUrl = 'https://send.maverickmarketingllc.com/api';

  // First, list current webhooks
  console.log('1. Current webhooks:\n');

  const listResponse = await fetch(`${baseUrl}/webhook-url`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (!listResponse.ok) {
    console.error(`❌ Failed to list webhooks: ${listResponse.status}`);
    return;
  }

  const data = await listResponse.json();
  const webhooks = data.data || [];

  webhooks.forEach((webhook: any, i: number) => {
    console.log(`${i + 1}. ID: ${webhook.id} - ${webhook.name}`);
    console.log(`   URL: ${webhook.url}`);
    console.log(`   Events: ${webhook.events?.join(', ')}`);
    console.log('');
  });

  // Find the old webhook (bison-interested-webhook)
  const oldWebhook = webhooks.find((w: any) =>
    w.url?.includes('bison-interested-webhook')
  );

  if (!oldWebhook) {
    console.log('✅ Old webhook not found - already deleted or never existed');
    return;
  }

  console.log(`\n2. Deleting OLD webhook (ID: ${oldWebhook.id}):`);
  console.log(`   Name: ${oldWebhook.name}`);
  console.log(`   URL: ${oldWebhook.url}`);
  console.log(`   Reason: This webhook does NOT send Slack notifications\n`);

  // Delete the old webhook
  const deleteResponse = await fetch(`${baseUrl}/webhook-url/${oldWebhook.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (!deleteResponse.ok) {
    const errorText = await deleteResponse.text();
    console.error(`❌ Failed to delete webhook: ${deleteResponse.status}`);
    console.error(errorText);
    return;
  }

  console.log('✅ Old webhook deleted successfully!\n');

  // List webhooks again to confirm
  console.log('3. Remaining webhooks:\n');

  const finalListResponse = await fetch(`${baseUrl}/webhook-url`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (finalListResponse.ok) {
    const finalData = await finalListResponse.json();
    const finalWebhooks = finalData.data || [];

    finalWebhooks.forEach((webhook: any, i: number) => {
      console.log(`${i + 1}. ID: ${webhook.id} - ${webhook.name}`);
      console.log(`   URL: ${webhook.url}`);
      console.log(`   Events: ${webhook.events?.join(', ')}`);
      console.log('');
    });
  }

  console.log('✅ DONE!');
  console.log('\nNow only the universal-bison-webhook is active, which includes:');
  console.log('  - Lead tracking in database');
  console.log('  - Slack notifications');
  console.log('  - Metric increments');
}

deleteOldWebhook().catch(console.error);
