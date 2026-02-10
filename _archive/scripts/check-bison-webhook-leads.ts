import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBisonWebhookLeads() {
  console.log('=== CHECKING BISON WEBHOOK-BASED LEADS ===\n');

  // These are the possible tables where Bison webhook leads might be stored
  const tablesToCheck = [
    'bison_webhook_leads',
    'bison_leads',
    'webhook_leads',
    'leads',
    'client_leads'
  ];

  // 1. First, let's see what tables actually exist
  console.log('1. Checking what lead-related tables exist...');

  // Try each table
  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table as any)
        .select('*')
        .limit(1);

      if (!error) {
        console.log(`✓ Table "${table}" exists`);
        console.log(`  Sample row:`, data?.[0]);
      }
    } catch (e) {
      // Table doesn't exist
    }
  }

  // 2. Check client_registry for all clients with bison_workspace_id
  console.log('\n2. Checking all client portal clients...');
  const { data: clients, error: clientsError } = await supabase
    .from('client_registry')
    .select('workspace_id, workspace_name, bison_workspace_id, slack_webhook_url')
    .not('bison_workspace_id', 'is', null);

  if (clientsError) {
    console.error('Error:', clientsError);
    return;
  }

  console.log(`Found ${clients?.length || 0} clients with Bison integration:\n`);

  // 3. For each client, check both lead_sources and any webhook-based leads
  for (const client of clients || []) {
    console.log(`\n--- ${client.workspace_name} (ID: ${client.workspace_id}, Bison: ${client.bison_workspace_id}) ---`);

    // Check lead_sources
    const { data: sources } = await supabase
      .from('lead_sources')
      .select('id')
      .eq('client_id', client.workspace_id);

    console.log(`  Lead sources: ${sources?.length || 0}`);

    if (sources && sources.length > 0) {
      // Check raw_leads
      const { data: rawLeads } = await supabase
        .from('raw_leads')
        .select('id, created_at')
        .in('lead_source_id', sources.map(s => s.id))
        .order('created_at', { ascending: false })
        .limit(1);

      if (rawLeads && rawLeads.length > 0) {
        const daysSince = Math.floor((Date.now() - new Date(rawLeads[0].created_at).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  Last agent lead: ${rawLeads[0].created_at} (${daysSince} days ago)`);
      }
    }

    // Check if there's a Slack webhook (indicates they should be getting webhook notifications)
    if (client.slack_webhook_url) {
      console.log(`  ✓ Slack webhook configured`);
    }
  }

  console.log('\n=== END CHECK ===');
}

checkBisonWebhookLeads().catch(console.error);
