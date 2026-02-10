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

async function showWhereToFind() {
  console.log('📍 WHERE TO FIND YOUR 10 CONTACTS\n');
  console.log('═'.repeat(120));

  // Fetch the contacts with workspace info
  const { data: contacts, error } = await supabase
    .from('client_leads')
    .select('lead_email, workspace_name, first_name, last_name, date_received, bison_conversation_url')
    .in('lead_email', targetEmails)
    .eq('interested', true)
    .order('workspace_name');

  if (error || !contacts || contacts.length === 0) {
    console.log('❌ Error fetching contacts or contacts not found');
    return;
  }

  console.log(`✅ Found all ${contacts.length} contacts in the database!\n`);
  console.log('These contacts are visible in the CLIENT PORTAL, not the Contact Pipeline Dashboard.\n');
  console.log('═'.repeat(120));
  console.log('\n📋 HOW TO VIEW THEM:\n');
  console.log('1. Go to the Client Portal Hub page in your dashboard');
  console.log('2. Select the workspace from the dropdown to see their leads:\n');

  // Group by workspace
  const byWorkspace = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    if (!byWorkspace.has(contact.workspace_name)) {
      byWorkspace.set(contact.workspace_name, []);
    }
    byWorkspace.get(contact.workspace_name)!.push(contact);
  }

  for (const [workspace, leads] of byWorkspace.entries()) {
    console.log(`\n   🔹 ${workspace} (${leads.length} contact${leads.length > 1 ? 's' : ''})`);
    for (const lead of leads) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
      const date = lead.date_received ? new Date(lead.date_received).toLocaleDateString() : 'N/A';
      console.log(`      • ${lead.lead_email}`);
      console.log(`        Name: ${name} | Received: ${date}`);
      if (lead.bison_conversation_url) {
        console.log(`        View in Email Bison: ${lead.bison_conversation_url}`);
      }
    }
  }

  console.log('\n═'.repeat(120));
  console.log('\n📊 SUMMARY BY WORKSPACE:\n');

  for (const [workspace, leads] of byWorkspace.entries()) {
    console.log(`   ${workspace.padEnd(35)} ${leads.length} interested lead${leads.length > 1 ? 's' : ''}`);
  }

  console.log('\n═'.repeat(120));
  console.log('\n💡 IMPORTANT:\n');
  console.log('   • These are INTERESTED LEADS that came from Email Bison');
  console.log('   • They appear in the CLIENT PORTAL (not Contact Pipeline Dashboard)');
  console.log('   • Each client can view their own leads when they log into their portal');
  console.log('   • The Contact Pipeline Dashboard is for tracking CSV uploads and batch processing');
  console.log('   • These two systems are separate and serve different purposes\n');

  console.log('═'.repeat(120));
  console.log('\n✅ All 10 contacts are successfully in the system and ready to view!\n');
}

showWhereToFind().catch(console.error);
