import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFrontendQuery() {
  console.log('=== SIMULATING FRONTEND CLIENT PORTAL QUERY ===\n');

  const workspace = 'Tony Schmitz';

  console.log(`Testing query for workspace: "${workspace}"\n`);

  // Exact same query as ClientPortalPage.tsx:418-427
  let query = supabase
    .from('client_leads')
    .select('*')
    .eq('interested', true)
    .order('date_received', { ascending: false })
    .range(0, 9999);

  if (workspace) {
    query = query.eq('workspace_name', workspace);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  console.log(`✅ Query successful!`);
  console.log(`Total leads returned: ${data.length}\n`);

  if (data.length > 0) {
    console.log('Leads found:');
    data.forEach((lead, idx) => {
      console.log(`${idx + 1}. ${lead.first_name} ${lead.last_name} (${lead.lead_email || lead.email})`);
      console.log(`   Created: ${lead.created_at}`);
      console.log(`   Date Received: ${lead.date_received}`);
      console.log(`   Pipeline Stage: ${lead.pipeline_stage}`);
      console.log(`   Interested: ${lead.interested}`);
      console.log();
    });
  } else {
    console.log('⚠️ NO LEADS RETURNED');
    console.log('\nDebugging steps:');
    console.log('1. Check if leads exist without workspace filter:');

    const { data: allLeads } = await supabase
      .from('client_leads')
      .select('workspace_name, first_name, last_name, interested')
      .eq('interested', true)
      .limit(10);

    console.log(`   Total interested leads (all workspaces): ${allLeads?.length || 0}`);
    allLeads?.forEach(lead => {
      console.log(`   - ${lead.workspace_name}: ${lead.first_name} ${lead.last_name}`);
    });

    console.log('\n2. Check if Tony leads exist (any interested value):');
    const { data: tonyLeads } = await supabase
      .from('client_leads')
      .select('*')
      .eq('workspace_name', workspace);

    console.log(`   Total Tony leads: ${tonyLeads?.length || 0}`);
    tonyLeads?.forEach(lead => {
      console.log(`   - ${lead.first_name} ${lead.last_name} | interested: ${lead.interested}`);
    });
  }
}

testFrontendQuery().catch(console.error);
