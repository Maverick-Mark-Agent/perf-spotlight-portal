import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDavidAmiri() {
  console.log('=== COMPREHENSIVE DAVID AMIRI INVESTIGATION ===\n');

  // 1. Get workspace info
  console.log('1. Getting workspace information...');
  const { data: workspace, error: wsError } = await supabase
    .from('client_registry')
    .select('*')
    .eq('workspace_name', 'David Amiri')
    .single();

  if (wsError) {
    console.error('Error finding workspace:', wsError);
    return;
  }

  console.log('Workspace found:');
  console.log(`  Name: ${workspace.workspace_name}`);
  console.log(`  Bison Workspace ID: ${workspace.bison_workspace_id}`);
  console.log(`  Instance: ${workspace.bison_instance}`);
  console.log(`  Slack Webhook: ${workspace.slack_webhook_url ? 'Configured' : 'Not configured'}`);

  // 2. Check cleaned_leads table
  console.log('\n2. Checking cleaned_leads table...');
  const { data: allLeads, error: allLeadsError } = await supabase
    .from('cleaned_leads')
    .select('*')
    .eq('workspace_name', 'David Amiri')
    .order('created_at', { ascending: false });

  if (allLeadsError) {
    console.error('Error querying cleaned_leads:', allLeadsError);
  } else {
    console.log(`Total leads in cleaned_leads: ${allLeads?.length || 0}`);

    if (allLeads && allLeads.length > 0) {
      const lastLead = allLeads[0];
      console.log(`\nLast lead:`);
      console.log(`  Date: ${lastLead.created_at}`);
      console.log(`  Name: ${lastLead.lead_name}`);
      console.log(`  Email: ${lastLead.lead_email}`);

      const lastLeadDate = new Date(lastLead.created_at);
      const daysSince = Math.floor((Date.now() - lastLeadDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  Days since last lead: ${daysSince}`);

      // Show last 10 leads
      console.log('\nLast 10 leads:');
      allLeads.slice(0, 10).forEach((lead, i) => {
        console.log(`  ${i + 1}. ${lead.created_at} - ${lead.lead_name}`);
      });

      // Count leads by date
      const oct12 = allLeads.filter(l => new Date(l.created_at) >= new Date('2025-10-12')).length;
      const oct13 = allLeads.filter(l => new Date(l.created_at) >= new Date('2025-10-13')).length;
      const oct14 = allLeads.filter(l => new Date(l.created_at) >= new Date('2025-10-14')).length;

      console.log(`\nLeads by date:`);
      console.log(`  Since Oct 12: ${oct12}`);
      console.log(`  Since Oct 13: ${oct13}`);
      console.log(`  Since Oct 14 (today): ${oct14}`);
    }
  }

  // 3. Check webhook_delivery_log
  console.log('\n3. Checking webhook deliveries...');
  const { data: webhooks, error: webhookError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('bison_workspace_id', workspace.bison_workspace_id.toString())
    .order('received_at', { ascending: false })
    .limit(20);

  if (webhookError) {
    console.error('Error querying webhooks:', webhookError);
  } else {
    console.log(`Recent webhook deliveries: ${webhooks?.length || 0}`);
    webhooks?.forEach((wh, i) => {
      console.log(`  ${i + 1}. ${wh.received_at} - ${wh.event_type} - Status: ${wh.status}`);
      if (wh.error_message) {
        console.log(`     Error: ${wh.error_message}`);
      }
    });
  }

  // 4. Check all client portal users to see who's affected
  console.log('\n4. Checking all client portal accounts...');
  const { data: allClients, error: clientsError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id')
    .not('bison_workspace_id', 'is', null);

  if (!clientsError && allClients) {
    console.log(`\nTotal client portal accounts: ${allClients.length}`);

    // Check last lead for each client
    for (const client of allClients) {
      const { data: lastLead } = await supabase
        .from('cleaned_leads')
        .select('created_at')
        .eq('workspace_name', client.workspace_name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastLead) {
        const daysSince = Math.floor((Date.now() - new Date(lastLead.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const flag = daysSince > 2 ? '⚠️' : '✓';
        console.log(`  ${flag} ${client.workspace_name}: Last lead ${daysSince} days ago (${lastLead.created_at})`);
      } else {
        console.log(`  ❌ ${client.workspace_name}: No leads found`);
      }
    }
  }

  console.log('\n=== END INVESTIGATION ===');
}

checkDavidAmiri().catch(console.error);
