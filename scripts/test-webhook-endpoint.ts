// Test if the webhook endpoint is accessible and responding correctly

async function testWebhookEndpoint() {
  console.log('=== TESTING WEBHOOK ENDPOINT ACCESSIBILITY ===\n');

  const webhookUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

  // Test 1: Check if endpoint is reachable
  console.log('1. Testing endpoint accessibility...\n');

  try {
    const pingResponse = await fetch(webhookUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://send.maverickmarketingllc.com',
        'Access-Control-Request-Method': 'POST',
      }
    });

    console.log(`   CORS Preflight: ${pingResponse.status}`);

    if (pingResponse.ok) {
      console.log('   ✅ Endpoint is reachable and responds to CORS\n');
    } else {
      console.log('   ⚠️  Endpoint returned non-200 for OPTIONS\n');
    }
  } catch (error: any) {
    console.log(`   ❌ Cannot reach endpoint: ${error.message}\n`);
    return;
  }

  // Test 2: Send a malformed payload to see if it responds
  console.log('2. Testing endpoint with invalid payload...\n');

  try {
    const invalidResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
      },
      body: JSON.stringify({ test: 'invalid' })
    });

    console.log(`   Status: ${invalidResponse.status}`);
    const invalidData = await invalidResponse.json();
    console.log(`   Response:`, JSON.stringify(invalidData, null, 2));

    if (invalidResponse.status === 400) {
      console.log('   ✅ Endpoint correctly rejects invalid payloads\n');
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 3: Send a valid test payload
  console.log('3. Testing with valid payload from Email Bison format...\n');

  const validPayload = {
    event: {
      type: 'LEAD_INTERESTED',
      workspace_name: 'Tony Schmitz',
      workspace_id: 41,
      instance_url: 'https://send.maverickmarketingllc.com'
    },
    data: {
      lead: {
        id: 88888,
        email: 'endpoint-test-' + Date.now() + '@test.com',
        first_name: 'Endpoint',
        last_name: 'Test',
        custom_variables: [
          { name: 'phone', value: '555-1234' }
        ]
      },
      reply: {
        uuid: 'test-uuid-' + Date.now(),
        date_received: new Date().toISOString(),
        text_body: 'Test reply for endpoint validation'
      }
    }
  };

  try {
    const validResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
      },
      body: JSON.stringify(validPayload)
    });

    console.log(`   Status: ${validResponse.status}`);
    const validData = await validResponse.json();
    console.log(`   Response:`, JSON.stringify(validData, null, 2));

    if (validResponse.ok) {
      console.log('\n   ✅ Endpoint successfully processes valid webhooks!');
      console.log('   📱 Check Slack for the test notification\n');
    } else {
      console.log('\n   ❌ Endpoint rejected valid payload\n');
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  console.log('\n=== CONCLUSION ===\n');
  console.log('If all tests passed, the webhook endpoint is working correctly.');
  console.log('The issue is that Email Bison is not sending webhooks to it.');
  console.log('\nPossible reasons:');
  console.log('1. You\'re marking leads in a different Email Bison workspace (not workspace 41)');
  console.log('2. The action you\'re taking doesn\'t trigger "lead_interested" event');
  console.log('3. Email Bison has a delay or queue for webhooks');
  console.log('4. Email Bison\'s webhook delivery is failing (check their logs/status)');
  console.log('\nTo debug further, check Email Bison\'s webhook delivery logs if available.');
}

testWebhookEndpoint().catch(console.error);
