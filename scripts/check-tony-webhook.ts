import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTonyWebhook() {
  console.log('=== CHECKING TONY SCHMITZ WEBHOOK CONFIGURATION ===\n');

  // 1. Check client_registry for Tony
  const { data: clients, error: clientError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, bison_workspace_id, slack_webhook_url')
    .or('workspace_name.ilike.%tony%,display_name.ilike.%tony%,workspace_name.ilike.%schmitz%,display_name.ilike.%schmitz%');

  if (clientError) {
    console.error('Error fetching client:', clientError);
    return;
  }

  console.log('Client Configuration:');
  console.log(JSON.stringify(clients, null, 2));

  if (!clients || clients.length === 0) {
    console.log('\n❌ No client found for Tony Schmitz');
    return;
  }

  const tony = clients[0];

  if (!tony.slack_webhook_url) {
    console.log('\n❌ No Slack webhook URL configured for Tony Schmitz');
    return;
  }

  console.log('\n✅ Slack webhook URL is configured');

  // 2. Check recent leads
  const { data: leads, error: leadsError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', tony.workspace_name)
    .order('created_at', { ascending: false })
    .limit(10);

  if (leadsError) {
    console.error('\nError fetching leads:', leadsError);
  } else {
    console.log(`\nRecent Leads (last 10):`);
    console.log(`Total: ${leads?.length || 0}`);
    if (leads && leads.length > 0) {
      console.log('\nMost recent lead:');
      console.log(JSON.stringify(leads[0], null, 2));
    }
  }

  // 3. Check webhook delivery log
  const { data: webhookLogs, error: webhookError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', tony.workspace_name)
    .eq('event_type', 'lead_interested')
    .order('created_at', { ascending: false })
    .limit(5);

  if (webhookError) {
    console.error('\nError fetching webhook logs:', webhookError);
  } else {
    console.log(`\n\nWebhook Delivery Log (last 5):`);
    console.log(`Total: ${webhookLogs?.length || 0}`);
    if (webhookLogs && webhookLogs.length > 0) {
      webhookLogs.forEach((log, i) => {
        console.log(`\n${i + 1}. ${log.created_at}`);
        console.log(`   Status: ${log.status_code}`);
        console.log(`   Success: ${log.success}`);
        if (!log.success) {
          console.log(`   Error: ${log.error_message}`);
        }
      });
    } else {
      console.log('No webhook delivery logs found');
    }
  }
}

checkTonyWebhook().catch(console.error);
