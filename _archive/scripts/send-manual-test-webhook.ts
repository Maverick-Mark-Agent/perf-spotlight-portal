import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendManualTestWebhook() {
  console.log('=== SENDING MANUAL TEST WEBHOOK ===\n');

  // Create a realistic test payload matching Email Bison's format
  const testPayload = {
    event: {
      type: 'LEAD_INTERESTED',
      name: 'Lead Interested',
      instance_url: 'https://send.maverickmarketingllc.com',
      workspace_id: 41,
      workspace_name: 'Tony Schmitz'
    },
    data: {
      lead: {
        id: 999999,
        email: 'manual-test-' + Date.now() + '@example.com',
        first_name: 'Manual',
        last_name: 'Test',
        title: null,
        company: null,
        custom_variables: [
          { name: 'address', value: '456 Test Avenue' },
          { name: 'city', value: 'Lincoln' },
          { name: 'state', value: 'NE' },
          { name: 'zip', value: '68508' },
          { name: 'phone', value: '(402) 555-9999' },
          { name: 'renewal_date', value: 'December 1st' },
          { name: 'date_of_birth', value: '5/15/1975' },
          { name: 'home_value', value: '$325K' },
          { name: 'income', value: '100-149,000' }
        ]
      },
      reply: {
        id: 888888,
        uuid: 'manual-test-uuid-' + Date.now(),
        email_subject: 'Re: Your December 1st renewal',
        text_body: 'Hi, I would love to get a quote for my home insurance. My current policy expires soon and I am looking for better coverage options. Please give me a call at your earliest convenience. Thanks!',
        body_plain: 'Hi, I would love to get a quote for my home insurance. My current policy expires soon and I am looking for better coverage options. Please give me a call at your earliest convenience. Thanks!',
        date_received: new Date().toISOString(),
        interested: true,
        automated_reply: false
      }
    }
  };

  console.log('Test payload:');
  console.log(JSON.stringify(testPayload, null, 2));

  console.log('\nSending to: https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook\n');

  try {
    const response = await fetch('https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    const responseData = await response.json();

    console.log('=== RESPONSE FROM EDGE FUNCTION ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Response:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ Webhook processed successfully!\n');

      // Wait 2 seconds for database to update
      console.log('Waiting 2 seconds for database to update...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if lead was saved
      console.log('\n--- Checking if lead was saved to database ---');
      const { data: leads, error } = await supabase
        .from('client_leads')
        .select('*')
        .eq('workspace_name', 'Tony Schmitz')
        .ilike('first_name', '%manual%')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking database:', error);
      } else if (leads && leads.length > 0) {
        const lead = leads[0];
        console.log('✅ Lead found in database!');
        console.log(`   Name: ${lead.first_name} ${lead.last_name}`);
        console.log(`   Email: ${lead.lead_email}`);
        console.log(`   Created: ${lead.created_at}`);
        console.log(`   Pipeline Stage: ${lead.pipeline_stage}`);
      } else {
        console.log('❌ Lead NOT found in database');
      }

      // Check webhook_delivery_log
      console.log('\n--- Checking webhook delivery log ---');
      const { data: webhooks } = await supabase
        .from('webhook_delivery_log')
        .select('*')
        .eq('workspace_name', 'Tony Schmitz')
        .order('created_at', { ascending: false })
        .limit(1);

      if (webhooks && webhooks.length > 0) {
        const wh = webhooks[0];
        console.log('✅ Webhook logged!');
        console.log(`   Time: ${wh.created_at}`);
        console.log(`   Success: ${wh.success}`);
        console.log(`   Processing Time: ${wh.processing_time_ms}ms`);
        console.log(`   Error: ${wh.error_message || 'None'}`);
      }

      console.log('\n--- Slack Notification ---');
      console.log('⚠️ Check your Slack channel for the test notification!');
      console.log('It should show:');
      console.log('  Name: Manual Test');
      console.log('  Email: manual-test-...@example.com');
      console.log('  Address: 456 Test Avenue');
      console.log('  City: Lincoln');
      console.log('  State: NE');

    } else {
      console.log('\n❌ Webhook processing failed!');
      console.log('This indicates an issue with the Edge Function.');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR sending webhook:', error.message);
  }

  console.log('\n=== TEST COMPLETE ===');
  console.log('\nSummary:');
  console.log('1. Manual webhook sent to Supabase function');
  console.log('2. Check above for database and Slack results');
  console.log('3. If this test works, the issue is Email Bison not calling webhook #115');
}

sendManualTestWebhook().catch(console.error);
