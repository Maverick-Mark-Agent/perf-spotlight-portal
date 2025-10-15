import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addMissingLeads() {
  console.log('=== ADDING MISSING LEADS TO DAVID AMIRI ===\n');

  const missingEmails = [
    'salmaahmed3106@gmail.com',
    'rebeccannette@gmail.com'
  ];

  // First check if they already exist
  console.log('1. Checking if leads already exist...\n');
  for (const email of missingEmails) {
    const { data: existing } = await supabase
      .from('client_leads')
      .select('id, workspace_name, first_name, last_name, date_received')
      .eq('lead_email', email);

    if (existing && existing.length > 0) {
      console.log(`✓ ${email} already exists:`);
      existing.forEach(lead => {
        console.log(`  - Workspace: ${lead.workspace_name}, Name: ${lead.first_name} ${lead.last_name}, Date: ${lead.date_received}`);
      });
    } else {
      console.log(`✗ ${email} NOT FOUND in database`);
    }
  }

  console.log('\n2. Creating new lead records...\n');

  const leadsToInsert = [
    {
      workspace_name: 'David Amiri',
      lead_email: 'salmaahmed3106@gmail.com',
      first_name: 'Salma',
      last_name: 'Ahmed',
      date_received: new Date().toISOString(),
      interested: true,
      pipeline_stage: 'interested',
      pipeline_position: 0,
      lead_value: 500,
      icp: false,
      airtable_id: `manual_${Date.now()}_1`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      workspace_name: 'David Amiri',
      lead_email: 'rebeccannette@gmail.com',
      first_name: 'Rebecca',
      last_name: 'Annette',
      date_received: new Date().toISOString(),
      interested: true,
      pipeline_stage: 'interested',
      pipeline_position: 0,
      lead_value: 500,
      icp: false,
      airtable_id: `manual_${Date.now()}_2`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    }
  ];

  for (const lead of leadsToInsert) {
    console.log(`Adding ${lead.lead_email}...`);

    const { data, error } = await supabase
      .from('client_leads')
      .insert([lead])
      .select();

    if (error) {
      console.error(`❌ Error adding ${lead.lead_email}:`, error.message);
    } else {
      console.log(`✓ Successfully added ${lead.lead_email}`);
      console.log(`  ID: ${data[0]?.id}`);
    }
  }

  // Verify they're now in the database
  console.log('\n3. Verifying leads were added...\n');

  const { data: davidLeads, error: verifyError } = await supabase
    .from('client_leads')
    .select('id, first_name, last_name, lead_email, date_received')
    .eq('workspace_name', 'David Amiri')
    .in('lead_email', missingEmails);

  if (verifyError) {
    console.error('Error verifying:', verifyError);
  } else {
    console.log(`Found ${davidLeads?.length || 0} leads for David Amiri with these emails:`);
    davidLeads?.forEach((lead, i) => {
      console.log(`  ${i + 1}. ${lead.first_name} ${lead.last_name} (${lead.lead_email}) - ${lead.date_received}`);
    });
  }

  // Check total count
  const { count } = await supabase
    .from('client_leads')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_name', 'David Amiri');

  console.log(`\nTotal David Amiri leads: ${count}`);

  console.log('\n=== COMPLETE ===');
}

addMissingLeads().catch(console.error);
