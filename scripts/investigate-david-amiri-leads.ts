import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateDavidAmiriLeads() {
  console.log('=== DAVID AMIRI LEAD INVESTIGATION ===\n');

  // 1. Check client_registry for David Amiri
  console.log('1. Checking client_registry for David Amiri...');
  const { data: registryData, error: registryError } = await supabase
    .from('client_registry')
    .select('*')
    .ilike('workspace_name', '%David%Amiri%')
    .single();

  if (registryError) {
    console.log('Error finding David Amiri:', registryError);
    // Try display_name
    const { data: displayData, error: displayError } = await supabase
      .from('client_registry')
      .select('*')
      .ilike('display_name', '%David%Amiri%')
      .single();

    if (displayError) {
      console.log('Error with display_name search:', displayError);
      console.log('\nSearching all clients with "Amiri"...');
      const { data: allAmiri } = await supabase
        .from('client_registry')
        .select('workspace_name, display_name, bison_workspace_id')
        .or('workspace_name.ilike.%Amiri%,display_name.ilike.%Amiri%');
      console.log('Found:', allAmiri);
      return;
    }
    console.log('Found via display_name:', displayData);
  } else {
    console.log('Found David Amiri:');
    console.log(`  Workspace: ${registryData.workspace_name}`);
    console.log(`  Display Name: ${registryData.display_name}`);
    console.log(`  Bison Workspace ID: ${registryData.bison_workspace_id}`);
    console.log(`  Bison Instance: ${registryData.bison_instance}`);
    console.log(`  Has Custom API Key: ${registryData.bison_api_key ? 'Yes' : 'No'}`);
  }

  const workspaceName = registryData?.workspace_name || '';
  const bisonWorkspaceId = registryData?.bison_workspace_id || '';

  // 2. Check billable_leads table
  console.log('\n2. Checking billable_leads table...');
  const { data: leads, error: leadsError } = await supabase
    .from('billable_leads')
    .select('*')
    .eq('workspace_name', workspaceName)
    .order('lead_created_at', { ascending: false })
    .limit(10);

  if (leadsError) {
    console.log('Error querying billable_leads:', leadsError);
  } else {
    console.log(`Found ${leads?.length || 0} recent leads:`);
    leads?.forEach((lead, i) => {
      console.log(`  ${i + 1}. ${lead.lead_created_at} - ${lead.lead_name} (${lead.lead_email})`);
    });

    if (leads && leads.length > 0) {
      const lastLead = leads[0];
      console.log(`\n  Last lead date: ${lastLead.lead_created_at}`);
      const lastLeadDate = new Date(lastLead.lead_created_at);
      const daysSinceLastLead = Math.floor((Date.now() - lastLeadDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  Days since last lead: ${daysSinceLastLead}`);
    }
  }

  // 3. Count total leads
  console.log('\n3. Checking total lead count...');
  const { count: totalLeads, error: countError } = await supabase
    .from('billable_leads')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_name', workspaceName);

  if (countError) {
    console.log('Error counting leads:', countError);
  } else {
    console.log(`Total leads for David Amiri: ${totalLeads}`);
  }

  // 4. Check leads by date range (Oct 12 onwards)
  console.log('\n4. Checking leads since October 12, 2025...');
  const { data: recentLeads, count: recentCount } = await supabase
    .from('billable_leads')
    .select('*', { count: 'exact' })
    .eq('workspace_name', workspaceName)
    .gte('lead_created_at', '2025-10-12T00:00:00Z')
    .order('lead_created_at', { ascending: false });

  console.log(`Leads since Oct 12: ${recentCount}`);
  if (recentLeads && recentLeads.length > 0) {
    console.log('Recent leads:');
    recentLeads.forEach((lead, i) => {
      console.log(`  ${i + 1}. ${lead.lead_created_at} - ${lead.lead_name}`);
    });
  }

  // 5. Check webhook_delivery_log
  console.log('\n5. Checking webhook delivery logs...');
  const { data: webhookLogs, error: webhookError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_id', bisonWorkspaceId)
    .order('received_at', { ascending: false })
    .limit(20);

  if (webhookError) {
    console.log('Error querying webhook logs:', webhookError);
  } else {
    console.log(`Found ${webhookLogs?.length || 0} recent webhook deliveries:`);
    webhookLogs?.forEach((log, i) => {
      console.log(`  ${i + 1}. ${log.received_at} - Status: ${log.status}, Event: ${log.event_type}`);
    });
  }

  // 6. Check if webhook is registered
  console.log('\n6. Checking Bison webhook registration...');
  console.log(`Would need to check Bison API for workspace: ${bisonWorkspaceId}`);
  console.log(`Instance: ${registryData?.bison_instance}`);

  // 7. Check polling status
  console.log('\n7. Checking polling job status...');
  const { data: pollingStatus, error: pollingError } = await supabase
    .from('polling_job_status')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);

  if (pollingError) {
    console.log('Error querying polling status:', pollingError);
  } else {
    console.log('Recent polling jobs:');
    pollingStatus?.forEach((job, i) => {
      console.log(`  ${i + 1}. ${job.started_at} - Status: ${job.status}, Duration: ${job.duration_ms}ms`);
    });
  }

  console.log('\n=== END INVESTIGATION ===');
}

investigateDavidAmiriLeads().catch(console.error);
