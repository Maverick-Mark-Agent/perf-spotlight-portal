import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

const targetEmails = [
  'benjaminhkirsch@gmail.com',
  'kinderteacher@comcast.net',
  'charleneturenne@gmail.com',
  'sankar.stmt@gmail.com',
  'bcsavage4@yahoo.com',
  'rvalverde1515@gmail.com',
  'pattt2u@gmail.com',
  'jstuemky856@gmail.com',
  'tgrabski@comcast.net',
  'msdee665@comcast.net',
];

async function verifyFinalData() {
  console.log('✅ FINAL VERIFICATION - All 10 Contacts\n');
  console.log('═'.repeat(150));

  const { data: contacts, error } = await supabase
    .from('client_leads')
    .select('*')
    .in('lead_email', targetEmails)
    .order('workspace_name, lead_email');

  if (error || !contacts) {
    console.error('❌ Error fetching contacts:', error);
    return;
  }

  console.log(`Found ${contacts.length} contacts\n`);

  let allComplete = true;

  for (const contact of contacts) {
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';

    console.log(`\n${'─'.repeat(150)}`);
    console.log(`📧 ${contact.lead_email} - ${name}`);
    console.log(`   Workspace: ${contact.workspace_name}`);
    console.log(`   Pipeline Stage: ${contact.pipeline_stage}`);
    console.log(`   Interested: ${contact.interested ? '✅' : '❌'}`);

    // Check Email Bison URL
    if (contact.bison_conversation_url) {
      console.log(`   ✅ Email Bison URL: ${contact.bison_conversation_url}`);
    } else {
      console.log(`   ❌ Missing Email Bison URL`);
      allComplete = false;
    }

    // Check Phone
    if (contact.phone) {
      console.log(`   ✅ Phone: ${contact.phone}`);
    } else {
      console.log(`   ⚠️  Phone: Not available`);
    }

    // Check Custom Variables
    if (contact.custom_variables && Array.isArray(contact.custom_variables)) {
      console.log(`   ✅ Custom Variables: ${contact.custom_variables.length} variables`);

      // Show key fields
      const addressVar = contact.custom_variables.find((v: any) => v.name?.toLowerCase() === 'address');
      const cityVar = contact.custom_variables.find((v: any) => v.name?.toLowerCase() === 'city');
      const stateVar = contact.custom_variables.find((v: any) => v.name?.toLowerCase() === 'state');
      const zipVar = contact.custom_variables.find((v: any) => v.name?.toLowerCase() === 'zip');
      const renewalVar = contact.custom_variables.find((v: any) => v.name?.toLowerCase().includes('renewal'));
      const homeValueVar = contact.custom_variables.find((v: any) => v.name?.toLowerCase().includes('home value'));

      if (addressVar) console.log(`      📍 Address: ${addressVar.value}`);
      if (cityVar) console.log(`      🏙️  City: ${cityVar.value}`);
      if (stateVar) console.log(`      🗺️  State: ${stateVar.value}`);
      if (zipVar) console.log(`      📮 ZIP: ${zipVar.value}`);
      if (renewalVar) console.log(`      📅 Renewal: ${renewalVar.value}`);
      if (homeValueVar) console.log(`      🏠 Home Value: ${homeValueVar.value}`);

    } else {
      console.log(`   ❌ Missing Custom Variables`);
      allComplete = false;
    }

    // Check Date Received
    if (contact.date_received) {
      const date = new Date(contact.date_received).toLocaleString();
      console.log(`   ✅ Date Received: ${date}`);
    } else {
      console.log(`   ⚠️  Missing Date Received`);
    }
  }

  console.log(`\n${'═'.repeat(150)}\n`);

  if (allComplete) {
    console.log('✅ ALL CONTACTS ARE COMPLETE AND READY!\n');
  } else {
    console.log('⚠️  Some contacts have missing data (see above)\n');
  }

  console.log('📊 SUMMARY BY WORKSPACE:\n');

  const byWorkspace = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    if (!byWorkspace.has(contact.workspace_name)) {
      byWorkspace.set(contact.workspace_name, []);
    }
    byWorkspace.get(contact.workspace_name)!.push(contact);
  }

  for (const [workspace, leads] of byWorkspace.entries()) {
    const completeCount = leads.filter(l =>
      l.bison_conversation_url &&
      l.custom_variables &&
      Array.isArray(l.custom_variables) &&
      l.custom_variables.length > 0
    ).length;

    console.log(`   ${workspace.padEnd(35)} ${leads.length} contact${leads.length > 1 ? 's' : ''} (${completeCount}/${leads.length} complete)`);
  }

  console.log(`\n${'═'.repeat(150)}\n`);
  console.log('🎯 WHAT TO DO NEXT:\n');
  console.log('1. Open your dashboard and go to the Client Portal Hub');
  console.log('2. Select a workspace from the dropdown (e.g., "Danny Schwartz")');
  console.log('3. You should see the interested leads with:');
  console.log('   • Working Email Bison conversation links');
  console.log('   • Complete custom variables (address, renewal date, home value, etc.)');
  console.log('   • Phone numbers (where available)');
  console.log('   • All other lead information\n');
  console.log('4. Click on the Email Bison link to view the full conversation\n');
  console.log('═'.repeat(150));
}

verifyFinalData().catch(console.error);
