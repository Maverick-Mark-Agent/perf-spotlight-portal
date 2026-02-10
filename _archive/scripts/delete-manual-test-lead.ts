import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteManualTestLead() {
  console.log('=== DELETING MANUAL TEST LEAD ===\n');

  // Find the manual test lead
  const { data: testLeads, error: fetchError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .or('first_name.eq.Manual,lead_email.ilike.%manual-test%');

  if (fetchError) {
    console.error('Error fetching test lead:', fetchError);
    return;
  }

  console.log(`Found ${testLeads.length} manual test lead(s):\n`);

  testLeads.forEach((lead, idx) => {
    console.log(`${idx + 1}. ${lead.first_name} ${lead.last_name}`);
    console.log(`   Email: ${lead.lead_email}`);
    console.log(`   Created: ${lead.created_at}`);
    console.log(`   ID: ${lead.id}`);
    console.log();
  });

  if (testLeads.length === 0) {
    console.log('No manual test leads found to delete.');
    return;
  }

  // Delete the test leads
  const idsToDelete = testLeads.map(lead => lead.id);

  console.log(`Deleting ${idsToDelete.length} manual test lead(s)...`);

  const { error: deleteError } = await supabase
    .from('client_leads')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error('❌ Error deleting test leads:', deleteError);
    return;
  }

  console.log(`✅ Successfully deleted ${idsToDelete.length} manual test lead(s)!\n`);

  // Verify deletion and show remaining leads
  console.log('--- Remaining Tony leads ---');
  const { data: remainingLeads } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false });

  console.log(`Total remaining leads: ${remainingLeads?.length || 0}\n`);

  remainingLeads?.forEach((lead, idx) => {
    console.log(`${idx + 1}. ${lead.first_name} ${lead.last_name} (${lead.lead_email})`);
    console.log(`   Created: ${lead.created_at}`);
  });

  console.log('\n✅ Cleanup complete!');
}

deleteManualTestLead().catch(console.error);
