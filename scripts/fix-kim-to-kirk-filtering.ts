import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const HIGH_NET_WORTH_THRESHOLD = 750000; // $750k+ homes

async function main() {
  console.log('=== Kim Wallace → Kirk Hodgson High Net Worth Texas Contact Filtering ===\n');

  // Step 1: Get Kim Wallace's workspace name
  console.log('Step 1: Finding Kim Wallace workspace...');
  const { data: kimWorkspace, error: kimWorkspaceError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name')
    .ilike('display_name', '%Kim Wallace%')
    .single();

  if (kimWorkspaceError || !kimWorkspace) {
    console.error('Could not find Kim Wallace workspace:', kimWorkspaceError);
    return;
  }

  console.log(`Found: ${kimWorkspace.display_name} (${kimWorkspace.workspace_name})\n`);

  // Step 2: Get Kirk Hodgson's workspace name
  console.log('Step 2: Finding Kirk Hodgson workspace...');
  const { data: kirkWorkspace, error: kirkWorkspaceError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name')
    .ilike('display_name', '%Kirk%Hodg%')
    .single();

  if (kirkWorkspaceError || !kirkWorkspace) {
    console.error('Could not find Kirk Hodgson workspace:', kirkWorkspaceError);
    return;
  }

  console.log(`Found: ${kirkWorkspace.display_name} (${kirkWorkspace.workspace_name})\n`);

  // Step 3: Check Kim Wallace's November verified contacts
  console.log('Step 3: Analyzing Kim Wallace November verified contacts...');
  const { data: kimContacts, error: kimError } = await supabase
    .from('verified_contacts')
    .select('*')
    .eq('workspace_name', kimWorkspace.workspace_name)
    .eq('month', '2025-11');

  if (kimError) {
    console.error('Error fetching Kim contacts:', kimError);
    return;
  }

  console.log(`Total Kim Wallace verified contacts: ${kimContacts?.length || 0}`);

  const texasContacts = kimContacts?.filter(c => c.property_state === 'TX') || [];
  console.log(`Texas contacts: ${texasContacts.length}`);

  const highNetWorthTx = texasContacts.filter(c => (c.home_value_estimate || 0) >= HIGH_NET_WORTH_THRESHOLD);
  console.log(`High net worth Texas contacts (≥$${HIGH_NET_WORTH_THRESHOLD.toLocaleString()}): ${highNetWorthTx.length}\n`);

  // Step 4: Check Kirk Hodgson's current November contacts
  console.log('Step 4: Checking Kirk Hodgson current November verified contacts...');
  const { data: kirkContacts, error: kirkError } = await supabase
    .from('verified_contacts')
    .select('*')
    .eq('workspace_name', kirkWorkspace.workspace_name)
    .eq('month', '2025-11');

  if (kirkError) {
    console.error('Error fetching Kirk contacts:', kirkError);
    return;
  }

  console.log(`Total Kirk Hodgson contacts: ${kirkContacts?.length || 0}`);
  const kirkTexasHNW = kirkContacts?.filter(c => c.property_state === 'TX' && (c.home_value_estimate || 0) >= HIGH_NET_WORTH_THRESHOLD) || [];
  console.log(`Kirk's current high net worth Texas contacts: ${kirkTexasHNW.length}\n`);

  // Step 5: Show sample of contacts that should be filtered
  if (highNetWorthTx.length > 0) {
    console.log('Step 5: Sample of high net worth Texas contacts from Kim Wallace:');
    highNetWorthTx.slice(0, 5).forEach((contact, idx) => {
      console.log(`  ${idx + 1}. ${contact.first_name} ${contact.last_name} - ${contact.property_city}, ${contact.property_state} - $${contact.home_value_estimate?.toLocaleString()}`);
    });
    console.log();
  }

  // Step 6: Check if any of these contacts already exist for Kirk (by email to avoid duplicates)
  console.log('Step 6: Checking for duplicate contacts...');
  const highNetWorthEmails = highNetWorthTx.map(c => c.email);

  const { data: existingKirkContacts, error: existingError } = await supabase
    .from('verified_contacts')
    .select('email')
    .eq('workspace_name', kirkWorkspace.workspace_name)
    .eq('month', '2025-11')
    .in('email', highNetWorthEmails);

  if (existingError) {
    console.error('Error checking duplicates:', existingError);
    return;
  }

  const existingEmails = new Set(existingKirkContacts?.map(c => c.email) || []);
  const newContacts = highNetWorthTx.filter(c => !existingEmails.has(c.email));

  console.log(`Contacts already in Kirk's pipeline: ${existingEmails.size}`);
  console.log(`New contacts to add: ${newContacts.length}\n`);

  if (newContacts.length === 0) {
    console.log('✅ All high net worth Texas contacts are already in Kirk Hodgson\'s pipeline!');
    return;
  }

  // Step 7: Create the filtered contacts for Kirk
  console.log(`Step 7: Creating ${newContacts.length} filtered contacts for Kirk Hodgson...`);

  const contactsToInsert = newContacts.map(contact => {
    const { id, raw_contact_id, created_at, updated_at, ...contactData } = contact;
    return {
      ...contactData,
      workspace_name: kirkWorkspace.workspace_name,
      // Keep all other fields including debounce verification, renewal dates, etc.
    };
  });

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < contactsToInsert.length; i += batchSize) {
    const batch = contactsToInsert.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('verified_contacts')
      .insert(batch);

    if (insertError) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
      console.error('Error details:', insertError);
      continue;
    }

    inserted += batch.length;
    console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} contacts (total: ${inserted})`);
  }

  console.log(`\n✅ Successfully created ${inserted} filtered contacts for Kirk Hodgson!`);

  // Step 8: Verify final counts
  console.log('\nStep 8: Verifying final counts...');
  const { data: finalKirkContacts } = await supabase
    .from('verified_contacts')
    .select('*')
    .eq('workspace_name', kirkWorkspace.workspace_name)
    .eq('month', '2025-11');

  const finalHighNetWorthTx = finalKirkContacts?.filter(c => c.property_state === 'TX' && (c.home_value_estimate || 0) >= HIGH_NET_WORTH_THRESHOLD) || [];
  console.log(`Kirk Hodgson's high net worth Texas contacts: ${finalHighNetWorthTx.length}`);
  console.log(`Total Kirk Hodgson November contacts: ${finalKirkContacts?.length || 0}`);

  console.log('\n=== Summary ===');
  console.log(`✅ Added ${inserted} high net worth Texas contacts to Kirk Hodgson's pipeline`);
  console.log(`✅ These contacts were originally uploaded to Kim Wallace`);
  console.log(`✅ All contacts have home values ≥$${HIGH_NET_WORTH_THRESHOLD.toLocaleString()}`);
  console.log(`✅ Kirk Hodgson now has ${finalHighNetWorthTx.length} total HNW Texas contacts for November`);
}

main().catch(console.error);
