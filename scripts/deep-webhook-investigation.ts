import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateWebhookIssue() {
  console.log('=== DEEP WEBHOOK INVESTIGATION ===\n');

  // 1. Check all webhook deliveries for Tony in the last 48 hours
  console.log('1. WEBHOOK DELIVERY LOG (Last 48 hours):');
  const { data: webhooks, error: webhookError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (webhookError) {
    console.error('Error fetching webhooks:', webhookError);
  } else {
    const oct13 = webhooks.filter(w => w.created_at.startsWith('2025-10-13'));
    const oct14 = webhooks.filter(w => w.created_at.startsWith('2025-10-14'));

    console.log(`Oct 13: ${oct13.length} webhooks`);
    console.log(`Oct 14: ${oct14.length} webhooks`);

    console.log('\nOct 13 Tony webhooks:');
    oct13.filter(w => w.workspace_name?.toLowerCase().includes('tony')).forEach(w => {
      console.log(`  - ${w.created_at}: ${w.event_type} | ${w.lead_email} | Status: ${w.status}`);
    });

    console.log('\nOct 14 Tony webhooks:');
    oct14.filter(w => w.workspace_name?.toLowerCase().includes('tony')).forEach(w => {
      console.log(`  - ${w.created_at}: ${w.event_type} | ${w.lead_email} | Status: ${w.status}`);
    });
  }

  // 2. Check client_leads for Tony
  console.log('\n2. CLIENT_LEADS TABLE:');
  const { data: leads, error: leadsError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('account_name', 'Tony Schmitz')
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (leadsError) {
    console.error('Error fetching leads:', leadsError);
  } else {
    console.log(`Total leads in last 48h: ${leads.length}`);
    leads.forEach(lead => {
      console.log(`  - ${lead.created_at}: ${lead.first_name} ${lead.last_name} (${lead.email})`);
    });
  }

  // 3. Check contact_pipeline for Tony
  console.log('\n3. CONTACT_PIPELINE TABLE:');
  const { data: pipeline, error: pipelineError } = await supabase
    .from('contact_pipeline')
    .select('*')
    .ilike('account_name', '%tony%')
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (pipelineError) {
    console.error('Error fetching pipeline:', pipelineError);
  } else {
    console.log(`Total pipeline entries in last 48h: ${pipeline.length}`);
    pipeline.forEach(p => {
      console.log(`  - ${p.created_at}: ${p.first_name} ${p.last_name} (${p.email}) | State: ${p.state}`);
    });
  }

  // 4. Check client_registry configuration
  console.log('\n4. CLIENT_REGISTRY CONFIGURATION:');
  const { data: client, error: clientError } = await supabase
    .from('client_registry')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (clientError) {
    console.error('Error fetching client:', clientError);
  } else {
    console.log('Tony Schmitz config:');
    console.log(`  Workspace ID: ${client.bison_workspace_id}`);
    console.log(`  Webhook URL: ${client.bison_webhook_url}`);
    console.log(`  Webhook Enabled: ${client.bison_webhook_enabled}`);
    console.log(`  Webhook Events: ${JSON.stringify(client.bison_webhook_events)}`);
    console.log(`  Slack Webhook: ${client.slack_webhook_url ? 'Configured' : 'Not configured'}`);
    console.log(`  API Key: ${client.bison_api_key ? 'Present' : 'Missing'}`);
  }

  // 5. Query Email Bison API for current webhook configuration
  console.log('\n5. EMAIL BISON API WEBHOOK STATUS:');
  try {
    const apiKey = client.bison_api_key;
    if (apiKey) {
      const response = await fetch('https://app.emailbison.com/api/webhook-url', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('Current webhooks registered in Email Bison:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error('Error fetching Email Bison webhooks:', error.message);
  }

  // 6. Check if any other workspaces are receiving webhooks today
  console.log('\n6. OTHER WORKSPACES WEBHOOK ACTIVITY (Oct 14):');
  const otherWorkspaces = webhooks?.filter(w =>
    w.created_at.startsWith('2025-10-14') &&
    w.event_type === 'lead_interested'
  );

  const workspaceStats = otherWorkspaces?.reduce((acc: any, w: any) => {
    acc[w.workspace_name] = (acc[w.workspace_name] || 0) + 1;
    return acc;
  }, {});

  console.log('Workspaces receiving lead_interested webhooks today:');
  Object.entries(workspaceStats || {}).forEach(([name, count]) => {
    console.log(`  ${name}: ${count} webhooks`);
  });

  console.log('\n=== INVESTIGATION COMPLETE ===');
}

investigateWebhookIssue().catch(console.error);
