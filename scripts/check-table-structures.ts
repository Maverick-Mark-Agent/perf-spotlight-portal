import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructures() {
  console.log('=== CHECKING TABLE STRUCTURES ===\n');

  // 1. Check client_leads table
  console.log('1. CLIENT_LEADS TABLE:');
  const { data: leads, error: leadsError } = await supabase
    .from('client_leads')
    .select('*')
    .limit(1);

  if (leadsError) {
    console.error('Error fetching client_leads:', leadsError);
  } else {
    console.log('Sample row columns:', Object.keys(leads[0] || {}));
    console.log('Sample data:', leads[0]);
  }

  // 2. Check for Tony's leads with correct column
  console.log('\n2. TONY LEADS IN CLIENT_LEADS:');
  const { data: tonyLeads, error: tonyError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(5);

  if (tonyError) {
    console.error('Error:', tonyError);
  } else {
    console.log(`Total Tony leads found: ${tonyLeads.length}`);
    tonyLeads.forEach(lead => {
      console.log(`  ${lead.created_at}: ${lead.first_name} ${lead.last_name} (${lead.email})`);
    });
  }

  // 3. Check webhook_delivery_log structure
  console.log('\n3. WEBHOOK_DELIVERY_LOG SAMPLE:');
  const { data: webhookSample, error: webhookError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .gte('created_at', '2025-10-14T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(1);

  if (webhookError) {
    console.error('Error:', webhookError);
  } else if (webhookSample && webhookSample.length > 0) {
    console.log('Columns:', Object.keys(webhookSample[0]));
    console.log('Full sample:');
    console.log(JSON.stringify(webhookSample[0], null, 2));
  }

  // 4. Look for contact-related tables
  console.log('\n4. SEARCHING FOR CONTACT/PIPELINE TABLES:');

  // Try raw_contacts
  const { data: rawContacts, error: rawError } = await supabase
    .from('raw_contacts')
    .select('*')
    .limit(1);

  if (!rawError) {
    console.log('✅ raw_contacts table exists');
    console.log('Columns:', Object.keys(rawContacts[0] || {}));
  } else {
    console.log('❌ raw_contacts table not accessible:', rawError.message);
  }

  // Try monthly_contact_pipeline_summary
  const { data: pipeline, error: pipelineError } = await supabase
    .from('monthly_contact_pipeline_summary')
    .select('*')
    .limit(1);

  if (!pipelineError) {
    console.log('✅ monthly_contact_pipeline_summary table exists');
    console.log('Columns:', Object.keys(pipeline[0] || {}));
  } else {
    console.log('❌ monthly_contact_pipeline_summary not accessible:', pipelineError.message);
  }

  // 5. Check the actual webhook payload from delivery log
  console.log('\n5. CHECKING WEBHOOK PAYLOAD DATA:');
  const { data: recentWebhook } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(1);

  if (recentWebhook && recentWebhook.length > 0) {
    const wh = recentWebhook[0];
    console.log('Most recent Tony webhook:');
    console.log(`  Created: ${wh.created_at}`);
    console.log(`  Event Type: ${wh.event_type}`);
    console.log(`  Status: ${wh.status}`);
    console.log(`  Lead Email: ${wh.lead_email}`);
    console.log(`  Lead Name: ${wh.lead_name}`);
    console.log(`  Error: ${wh.error_message}`);
    console.log(`  Payload preview: ${JSON.stringify(wh).substring(0, 500)}`);
  }
}

checkTableStructures().catch(console.error);
