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

async function fixWorkspaceNames() {
  console.log('🔍 Checking workspace name consistency...\n');
  console.log('═'.repeat(120));

  // Get all client registry workspace names (the source of truth)
  const { data: clients, error: clientError } = await supabase
    .from('client_registry')
    .select('workspace_name')
    .eq('is_active', true);

  if (clientError) {
    console.error('❌ Error fetching client registry:', clientError);
    return;
  }

  const validWorkspaceNames = new Set(clients?.map(c => c.workspace_name) || []);
  console.log(`✅ Found ${validWorkspaceNames.size} valid workspace names in client_registry\n`);

  // Get our contacts
  const { data: contacts, error: contactError } = await supabase
    .from('client_leads')
    .select('id, lead_email, workspace_name')
    .in('lead_email', targetEmails);

  if (contactError) {
    console.error('❌ Error fetching contacts:', contactError);
    return;
  }

  console.log(`Checking ${contacts?.length || 0} contacts...\n`);

  const mismatches = [];
  const needsFix = [];

  for (const contact of contacts || []) {
    const isValid = validWorkspaceNames.has(contact.workspace_name);

    if (!isValid) {
      // Try to find a case-insensitive match
      const normalizedCurrent = contact.workspace_name.toLowerCase();
      let correctName = null;

      for (const validName of validWorkspaceNames) {
        if (validName.toLowerCase() === normalizedCurrent) {
          correctName = validName;
          break;
        }
      }

      if (correctName) {
        mismatches.push({
          email: contact.lead_email,
          current: contact.workspace_name,
          correct: correctName,
          id: contact.id,
        });
        console.log(`❌ Mismatch: ${contact.lead_email}`);
        console.log(`   Current:  "${contact.workspace_name}"`);
        console.log(`   Correct:  "${correctName}"\n`);
      } else {
        console.log(`⚠️  No match found for: ${contact.lead_email} (${contact.workspace_name})`);
      }
    } else {
      console.log(`✅ ${contact.lead_email.padEnd(35)} ${contact.workspace_name}`);
    }
  }

  if (mismatches.length === 0) {
    console.log('\n✅ All workspace names are correct!\n');
    return;
  }

  console.log('\n═'.repeat(120));
  console.log(`\n🔧 Fixing ${mismatches.length} workspace name mismatch(es)...\n`);

  for (const mismatch of mismatches) {
    const { error: updateError } = await supabase
      .from('client_leads')
      .update({ workspace_name: mismatch.correct })
      .eq('id', mismatch.id);

    if (updateError) {
      console.log(`❌ Failed to update ${mismatch.email}: ${updateError.message}`);
    } else {
      console.log(`✅ Updated: ${mismatch.email}`);
      console.log(`   "${mismatch.current}" → "${mismatch.correct}"`);
    }
  }

  console.log('\n═'.repeat(120));
  console.log('\n✅ All workspace names have been corrected!\n');
  console.log('All contacts should now be visible in their respective client portals.\n');
}

fixWorkspaceNames().catch(console.error);
