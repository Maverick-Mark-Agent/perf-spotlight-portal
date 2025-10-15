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

async function verifyContacts() {
  console.log('🔍 Verifying contacts in production database...\n');

  const { data: contacts, error } = await supabase
    .from('client_leads')
    .select('*')
    .in('lead_email', targetEmails)
    .order('workspace_name');

  if (error) {
    console.error('❌ Error querying database:', error);
    console.error('   This might be a permissions issue with the anon key');
    return;
  }

  console.log(`Found ${contacts?.length || 0} contacts in client_leads table\n`);

  if (contacts && contacts.length > 0) {
    console.log('═'.repeat(150));
    console.log(
      'EMAIL'.padEnd(35) +
      'WORKSPACE'.padEnd(30) +
      'STAGE'.padEnd(15) +
      'INTERESTED'.padEnd(12) +
      'DATE RECEIVED'.padEnd(30) +
      'AIRTABLE_ID'
    );
    console.log('═'.repeat(150));

    for (const contact of contacts) {
      console.log(
        (contact.lead_email || '').padEnd(35) +
        (contact.workspace_name || '').padEnd(30) +
        (contact.pipeline_stage || 'N/A').padEnd(15) +
        (contact.interested ? '✅ Yes' : '❌ No').padEnd(12) +
        (contact.date_received ? new Date(contact.date_received).toLocaleString() : 'N/A').padEnd(30) +
        (contact.airtable_id || 'N/A')
      );
    }

    console.log('═'.repeat(150));
    console.log(`\n✅ All ${contacts.length} contacts are in the database!`);
    console.log('   These should be visible in the Contact Pipeline Dashboard.\n');

    // Check which ones have all required fields
    const complete = contacts.filter(c =>
      c.lead_email &&
      c.workspace_name &&
      c.pipeline_stage === 'interested' &&
      c.interested === true &&
      c.bison_conversation_url
    );

    console.log(`📊 Complete records (with all fields): ${complete.length}/${contacts.length}`);

    const missing = contacts.filter(c =>
      !c.bison_conversation_url ||
      c.pipeline_stage !== 'interested' ||
      c.interested !== true
    );

    if (missing.length > 0) {
      console.log('\n⚠️  Incomplete records:');
      for (const contact of missing) {
        console.log(`   - ${contact.lead_email}`);
        if (!contact.bison_conversation_url) console.log('     Missing: conversation URL');
        if (contact.pipeline_stage !== 'interested') console.log(`     Wrong stage: ${contact.pipeline_stage}`);
        if (!contact.interested) console.log('     Not marked as interested');
      }
    }
  } else {
    console.log('❌ No contacts found in database!');
    console.log('   The insert may have failed silently or been rolled back.\n');
  }

  // Check total count in client_leads
  const { count, error: countError } = await supabase
    .from('client_leads')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`\n📈 Total records in client_leads table: ${count}`);
  }
}

verifyContacts().catch(console.error);
