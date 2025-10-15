import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTonyLeadsDetail() {
  console.log('=== TONY LEADS DETAILED ANALYSIS ===\n');

  // 1. Check all Tony leads with full data
  console.log('1. ALL TONY LEADS IN CLIENT_LEADS:');
  const { data: leads, error } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total Tony leads: ${leads.length}\n`);

  leads.forEach((lead, idx) => {
    console.log(`--- Lead ${idx + 1} ---`);
    console.log(`Created: ${lead.created_at}`);
    console.log(`Name: ${lead.first_name} ${lead.last_name}`);
    console.log(`Email: ${lead.email || lead.lead_email || 'NO EMAIL'}`);
    console.log(`Phone: ${lead.phone}`);
    console.log(`Company: ${lead.company}`);
    console.log(`Title: ${lead.title}`);
    console.log(`Pipeline Stage: ${lead.pipeline_stage}`);
    console.log(`Interested: ${lead.interested}`);
    console.log(`Conversation URL: ${lead.bison_conversation_url}`);
    console.log(`Custom Variables: ${JSON.stringify(lead.custom_variables)}`);
    console.log();
  });

  // 2. Check webhook_delivery_log for detailed payload
  console.log('\n2. RECENT WEBHOOK PAYLOADS (Last 3):');
  const { data: webhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(3);

  webhooks?.forEach((wh, idx) => {
    console.log(`\n--- Webhook ${idx + 1} ---`);
    console.log(`Time: ${wh.created_at}`);
    console.log(`Success: ${wh.success}`);
    console.log(`Error: ${wh.error_message || 'None'}`);
    console.log(`Processing Time: ${wh.processing_time_ms}ms`);
    console.log(`\nFull Payload:`);
    console.log(JSON.stringify(wh.payload, null, 2));
  });

  // 3. Check if there are actual real leads (not test leads)
  console.log('\n3. REAL LEADS (excluding test):');
  const realLeads = leads.filter(lead =>
    !lead.first_name?.toLowerCase().includes('test') &&
    !lead.last_name?.toLowerCase().includes('test') &&
    !lead.email?.includes('test')
  );

  console.log(`Real leads count: ${realLeads.length}`);
  realLeads.forEach(lead => {
    console.log(`  ${lead.created_at}: ${lead.first_name} ${lead.last_name} (${lead.lead_email || lead.email})`);
  });

  // 4. Check if leads from Oct 13 are still there
  console.log('\n4. LEADS FROM OCT 13 (Yesterday):');
  const oct13Leads = leads.filter(lead =>
    lead.created_at >= '2025-10-13T00:00:00Z' &&
    lead.created_at < '2025-10-14T00:00:00Z'
  );

  console.log(`Oct 13 leads: ${oct13Leads.length}`);
  oct13Leads.forEach(lead => {
    console.log(`  ${lead.created_at}: ${lead.first_name} ${lead.last_name} (${lead.lead_email || lead.email})`);
  });
}

checkTonyLeadsDetail().catch(console.error);
