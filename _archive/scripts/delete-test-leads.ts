import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteTestLeads() {
  console.log('=== DELETING TEST LEADS FROM TONY SCHMITZ ===\n');

  // Find all test leads for Tony
  const { data: testLeads, error: fetchError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .or('lead_email.ilike.%test%,first_name.ilike.%test%,last_name.ilike.%test%');

  if (fetchError) {
    console.error('Error fetching test leads:', fetchError);
    return;
  }

  console.log(`Found ${testLeads.length} test leads:\n`);

  testLeads.forEach((lead, idx) => {
    console.log(`${idx + 1}. ${lead.first_name} ${lead.last_name}`);
    console.log(`   Email: ${lead.lead_email || lead.email}`);
    console.log(`   Created: ${lead.created_at}`);
    console.log(`   ID: ${lead.id}`);
    console.log();
  });

  // Delete the test leads
  const idsToDelete = testLeads.map(lead => lead.id);

  if (idsToDelete.length === 0) {
    console.log('No test leads to delete.');
    return;
  }

  console.log(`\nDeleting ${idsToDelete.length} test leads...`);

  const { error: deleteError } = await supabase
    .from('client_leads')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error('❌ Error deleting test leads:', deleteError);
    return;
  }

  console.log(`✅ Successfully deleted ${idsToDelete.length} test leads!`);

  // Verify deletion
  console.log('\nVerifying remaining Tony leads:');
  const { data: remainingLeads } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false });

  console.log(`\nRemaining leads: ${remainingLeads?.length || 0}`);
  remainingLeads?.forEach((lead, idx) => {
    console.log(`${idx + 1}. ${lead.first_name} ${lead.last_name} (${lead.lead_email || lead.email})`);
    console.log(`   Created: ${lead.created_at}`);
  });
}

deleteTestLeads().catch(console.error);
