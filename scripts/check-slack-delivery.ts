import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSlackDelivery() {
  console.log('=== CHECKING SLACK NOTIFICATION STATUS ===\n');

  // 1. Get Tony's Slack webhook URL
  console.log('1. TONY SLACK CONFIGURATION:');
  const { data: client, error: clientError } = await supabase
    .from('client_registry')
    .select('workspace_name, slack_webhook_url, display_name')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (clientError) {
    console.error('Error fetching client:', clientError);
    return;
  }

  console.log(`Workspace: ${client.workspace_name}`);
  console.log(`Display Name: ${client.display_name}`);
  console.log(`Slack Webhook URL: ${client.slack_webhook_url ? '✅ Configured' : '❌ Not configured'}`);

  if (client.slack_webhook_url) {
    // Mask the webhook URL for security
    const url = client.slack_webhook_url;
    const masked = url.substring(0, 50) + '...' + url.substring(url.length - 20);
    console.log(`URL Preview: ${masked}`);
  }

  // 2. Check webhook_delivery_log for recent deliveries
  console.log('\n2. RECENT WEBHOOK DELIVERIES:');
  const { data: webhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .gte('created_at', '2025-10-14T00:00:00Z')
    .order('created_at', { ascending: false });

  console.log(`Total webhooks today: ${webhooks?.length || 0}\n`);

  webhooks?.forEach((wh, idx) => {
    console.log(`Webhook ${idx + 1}:`);
    console.log(`  Time: ${wh.created_at}`);
    console.log(`  Event: ${wh.event_type}`);
    console.log(`  Success: ${wh.success}`);
    console.log(`  Error: ${wh.error_message || 'None'}`);
    console.log(`  Processing Time: ${wh.processing_time_ms}ms`);

    // Check if lead info is in payload
    const lead = wh.payload?.data?.lead;
    if (lead) {
      console.log(`  Lead: ${lead.first_name} ${lead.last_name} (${lead.email})`);
    }
    console.log();
  });

  // 3. Check if there's a pattern of Slack failures
  console.log('3. SLACK NOTIFICATION ANALYSIS:');
  console.log('Note: The Edge Function logs Slack delivery separately from webhook success.');
  console.log('A webhook can be "successful" even if Slack notification fails (by design).\n');

  if (!client.slack_webhook_url) {
    console.log('⚠️ ISSUE FOUND: No Slack webhook URL configured!');
    console.log('This means notifications cannot be sent.');
    console.log('\nFIX: Add Slack webhook URL to client_registry:');
    console.log(`
    UPDATE client_registry
    SET slack_webhook_url = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
    WHERE workspace_name = 'Tony Schmitz';
    `);
  } else {
    console.log('✅ Slack webhook URL is configured');
    console.log('\nTo verify if Slack is receiving notifications:');
    console.log('1. Check the Slack channel for recent notifications');
    console.log('2. Test the webhook URL manually:');
    console.log(`
    curl -X POST "${client.slack_webhook_url.substring(0, 50)}..." \\
      -H "Content-Type: application/json" \\
      -d '{"text": "Test from Tony Schmitz webhook investigation"}'
    `);
  }

  // 4. Check OpenAI API key (needed for cleaning reply text)
  console.log('\n4. OPENAI API KEY STATUS:');
  console.log('The webhook uses OpenAI to clean reply text before sending to Slack.');
  console.log('If OPENAI_API_KEY is not set in Edge Function environment:');
  console.log('  - Notifications will still send');
  console.log('  - But reply text will be raw (first 200 chars)');
  console.log('\nTo check if OpenAI is working, review Edge Function logs.');
}

checkSlackDelivery().catch(console.error);
