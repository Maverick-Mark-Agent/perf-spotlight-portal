/**
 * Check what billable lead data we have available
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('🔍 Checking billable lead data availability...\n');

  // Check if client_leads table exists and has data
  const { data: leads, error: leadsError, count } = await supabase
    .from('client_leads')
    .select('*', { count: 'exact', head: false })
    .limit(5);

  if (leadsError) {
    console.error('❌ Error querying client_leads:', leadsError);
  } else {
    console.log(`✅ client_leads table found with ${count} total records\n`);
    if (leads && leads.length > 0) {
      console.log('Sample lead record:');
      console.log(JSON.stringify(leads[0], null, 2));
    }
  }

  // Check per-lead clients
  const { data: clients, error: clientsError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, billing_type, price_per_lead, monthly_kpi_target')
    .eq('is_active', true)
    .eq('billing_type', 'per_lead');

  if (clientsError) {
    console.error('❌ Error querying clients:', clientsError);
  } else {
    console.log(`\n✅ Found ${clients?.length || 0} active per-lead clients:\n`);
    clients?.forEach(c => {
      console.log(`  - ${c.display_name || c.workspace_name}: $${c.price_per_lead}/lead, ${c.monthly_kpi_target} KPI`);
    });
  }

  // Check current month leads
  const currentMonth = new Date().toISOString().slice(0, 7);
  console.log(`\n📊 Checking leads for current month (${currentMonth})...\n`);

  const { data: monthLeads, error: monthError } = await supabase
    .from('client_leads')
    .select('workspace_name, date_received, lead_value')
    .gte('date_received', `${currentMonth}-01`)
    .order('date_received', { ascending: true })
    .limit(10);

  if (monthError) {
    console.error('❌ Error:', monthError);
  } else {
    console.log(`Found ${monthLeads?.length || 0} leads this month (showing first 10):`);
    monthLeads?.forEach(lead => {
      console.log(`  ${lead.workspace_name}: ${lead.date_received} - $${lead.lead_value}`);
    });
  }
}

checkData().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
