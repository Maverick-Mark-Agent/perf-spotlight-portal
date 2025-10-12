import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKPISyncStatus() {
  console.log('='.repeat(80));
  console.log('CHECKING KPI SYNC STATUS');
  console.log('='.repeat(80));
  console.log();

  // Check client_metrics table for recent updates
  console.log('1. Checking client_metrics table for recent updates...');
  console.log('-'.repeat(80));
  try {
    const { data: clientMetrics, error: metricsError } = await supabase
      .from('client_metrics')
      .select('workspace_name, metric_date, metric_type, positive_replies_mtd, emails_sent_mtd, updated_at')
      .eq('metric_type', 'mtd')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (metricsError) {
      console.log(`❌ Error querying client_metrics: ${metricsError.message}`);
    } else if (clientMetrics && clientMetrics.length > 0) {
      console.log(`✅ Found ${clientMetrics.length} recent client_metrics entries:\n`);

      // Group by metric_date to see which dates have data
      const byDate = clientMetrics.reduce((acc: any, metric) => {
        const date = metric.metric_date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(metric);
        return acc;
      }, {});

      Object.entries(byDate).forEach(([date, metrics]: [string, any]) => {
        console.log(`  Date: ${date} (${metrics.length} clients updated)`);
        console.log(`    Last updated: ${metrics[0].updated_at}`);
        console.log(`    Sample: ${metrics[0].workspace_name} - ${metrics[0].positive_replies_mtd} replies, ${metrics[0].emails_sent_mtd} emails`);
      });

      // Check for 2025-10-10, 2025-10-11, 2025-10-12
      console.log('\n  Checking for specific dates:');
      ['2025-10-10', '2025-10-11', '2025-10-12'].forEach(date => {
        const found = clientMetrics.filter(m => m.metric_date === date);
        console.log(`    ${date}: ${found.length > 0 ? `✅ ${found.length} entries` : '❌ No entries'}`);
      });
    } else {
      console.log('❌ No client_metrics entries found');
    }
  } catch (err) {
    console.log(`❌ Exception checking client_metrics: ${err}`);
  }
  console.log();

  // Check webhook_delivery_log for recent webhook activity
  console.log('2. Checking webhook_delivery_log for recent activity...');
  console.log('-'.repeat(80));
  try {
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhook_delivery_log')
      .select('id, event_type, workspace_name, success, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(15);

    if (webhooksError) {
      console.log(`❌ Error querying webhook_delivery_log: ${webhooksError.message}`);
    } else if (webhooks && webhooks.length > 0) {
      console.log(`✅ Found ${webhooks.length} recent webhook deliveries:\n`);
      webhooks.forEach((webhook, idx) => {
        console.log(`  ${idx + 1}. ${webhook.created_at}`);
        console.log(`     Event: ${webhook.event_type}, Workspace: ${webhook.workspace_name}`);
        console.log(`     Status: ${webhook.success ? '✅ Success' : '❌ Failed'}`);
        if (webhook.error_message) {
          console.log(`     Error: ${webhook.error_message}`);
        }
      });
    } else {
      console.log('❌ No webhook delivery logs found');
    }
  } catch (err) {
    console.log(`❌ Exception checking webhook_delivery_log: ${err}`);
  }
  console.log();

  // Check client_registry for active clients
  console.log('3. Checking client_registry for active clients...');
  console.log('-'.repeat(80));
  try {
    const { data: clients, error: clientsError } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name, is_active, monthly_kpi_target, bison_api_key')
      .eq('is_active', true);

    if (clientsError) {
      console.log(`❌ Error querying client_registry: ${clientsError.message}`);
    } else if (clients && clients.length > 0) {
      console.log(`✅ Found ${clients.length} active clients:\n`);
      clients.forEach((client, idx) => {
        const hasApiKey = !!client.bison_api_key;
        console.log(`  ${idx + 1}. ${client.workspace_name} (${client.display_name})`);
        console.log(`     Target: ${client.monthly_kpi_target}, API Key: ${hasApiKey ? '✅' : '❌ MISSING'}`);
      });
    } else {
      console.log('❌ No active clients found');
    }
  } catch (err) {
    console.log(`❌ Exception checking client_registry: ${err}`);
  }
  console.log();

  console.log('='.repeat(80));
  console.log('Status check complete');
  console.log('='.repeat(80));
}

checkKPISyncStatus().catch(console.error);
