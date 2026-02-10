import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWebhookDetails() {
  console.log('=== CHECKING WEBHOOK DELIVERY DETAILS FOR TONY SCHMITZ ===\n');

  // Get webhook delivery logs with full payload
  const { data: logs, error } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .eq('event_type', 'lead_interested')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log('No webhook delivery logs found for Tony Schmitz');
    return;
  }

  console.log(`Found ${logs.length} recent webhook deliveries\n`);

  logs.forEach((log, i) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`DELIVERY ${i + 1}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Created: ${log.created_at}`);
    console.log(`Success: ${log.success}`);
    console.log(`Status Code: ${log.status_code}`);
    console.log(`Processing Time: ${log.processing_time_ms}ms`);
    console.log(`Error Message: ${log.error_message || 'None'}`);

    if (log.payload) {
      console.log('\nPayload Summary:');
      const payload = log.payload as any;
      console.log(`  Event Type: ${payload.event?.type}`);
      console.log(`  Workspace: ${payload.event?.workspace_name}`);

      if (payload.data?.lead) {
        const lead = payload.data.lead;
        console.log(`  Lead Email: ${lead.email}`);
        console.log(`  Lead Name: ${lead.first_name} ${lead.last_name}`);
      }

      if (payload.data?.reply) {
        const reply = payload.data.reply;
        console.log(`  Reply UUID: ${reply.uuid}`);
        console.log(`  Reply Date: ${reply.date_received}`);
        console.log(`  Reply Preview: ${(reply.text_body || reply.body_plain || '').substring(0, 100)}...`);
      }
    }
  });

  // Check if there's a pattern
  console.log('\n\n=== ANALYSIS ===');
  const allSuccess = logs.every(log => log.success);
  const allHaveStatusCode = logs.every(log => log.status_code !== null && log.status_code !== undefined);

  console.log(`All deliveries successful: ${allSuccess ? '✅ Yes' : '❌ No'}`);
  console.log(`All have status codes: ${allHaveStatusCode ? '✅ Yes' : '❌ No - This might be the issue!'}`);

  if (!allHaveStatusCode) {
    console.log('\n⚠️  STATUS CODE IS MISSING!');
    console.log('This suggests the Slack webhook call might not be happening or not being logged properly.');
  }
}

checkWebhookDetails().catch(console.error);
