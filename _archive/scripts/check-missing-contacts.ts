import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Missing contacts mapping: email -> workspace_name
const missingContacts = [
  { email: 'benjaminhkirsch@gmail.com', workspace_name: 'STREETSMART COMMERCIAL' },
  { email: 'kinderteacher@comcast.net', workspace_name: 'ROB Russell' },
  { email: 'charleneturenne@gmail.com', workspace_name: 'NICK SAKHA' },
  { email: 'sankar.stmt@gmail.com', workspace_name: 'Kirk hodgson' },
  { email: 'bcsavage4@yahoo.com', workspace_name: 'John Roberts' },
  { email: 'rvalverde1515@gmail.com', workspace_name: 'Jason Binyon' },
  { email: 'pattt2u@gmail.com', workspace_name: 'David Amiri' },
  { email: 'jstuemky856@gmail.com', workspace_name: 'David Amiri' },
  { email: 'tgrabski@comcast.net', workspace_name: 'Danny Schwartz' },
  { email: 'msdee665@comcast.net', workspace_name: 'Danny Schwartz' },
];

async function checkMissingContacts() {
  console.log('🔍 Checking for missing contacts in client_leads table...\n');

  const emails = missingContacts.map(c => c.email);

  // Check which contacts exist
  const { data: existingLeads, error: queryError } = await supabase
    .from('client_leads')
    .select('lead_email, workspace_name, pipeline_stage, interested, date_received, bison_conversation_url')
    .in('lead_email', emails);

  if (queryError) {
    console.error('❌ Error querying database:', queryError);
    return;
  }

  console.log(`Found ${existingLeads?.length || 0} existing contacts out of ${missingContacts.length}\n`);

  // Create a map of existing leads
  const existingMap = new Map(existingLeads?.map(lead => [lead.lead_email.toLowerCase(), lead]) || []);

  console.log('═'.repeat(100));
  console.log('EMAIL'.padEnd(35) + 'WORKSPACE'.padEnd(30) + 'STATUS'.padEnd(20) + 'IN DB?');
  console.log('═'.repeat(100));

  const missing = [];
  const existing = [];

  for (const contact of missingContacts) {
    const existingLead = existingMap.get(contact.email.toLowerCase());

    if (existingLead) {
      existing.push({ ...contact, existingLead });
      const status = existingLead.pipeline_stage || 'unknown';
      console.log(
        contact.email.padEnd(35) +
        contact.workspace_name.padEnd(30) +
        status.padEnd(20) +
        '✅ YES'
      );
    } else {
      missing.push(contact);
      console.log(
        contact.email.padEnd(35) +
        contact.workspace_name.padEnd(30) +
        '-'.padEnd(20) +
        '❌ MISSING'
      );
    }
  }

  console.log('═'.repeat(100));
  console.log(`\n📊 Summary:`);
  console.log(`   Total Contacts: ${missingContacts.length}`);
  console.log(`   Found in DB: ${existing.length}`);
  console.log(`   Missing from DB: ${missing.length}\n`);

  return { missing, existing };
}

async function fetchFromEmailBison() {
  console.log('\n🔎 Fetching contact details from Email Bison...\n');

  // Get workspace mappings from client_registry
  const { data: workspaces, error: wsError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
    .eq('is_active', true);

  if (wsError) {
    console.error('❌ Error fetching workspaces:', wsError);
    return [];
  }

  // Create workspace map (normalized names)
  const workspaceMap = new Map();
  for (const ws of workspaces || []) {
    workspaceMap.set(ws.workspace_name.toLowerCase(), ws);
  }

  const MAVERICK_API_KEY = process.env.EMAIL_BISON_API_KEY || '';
  const LONGRUN_API_KEY = process.env.LONG_RUN_BISON_API_KEY || '';

  const results = [];

  // Group contacts by workspace
  const contactsByWorkspace = new Map();
  for (const contact of missingContacts) {
    if (!contactsByWorkspace.has(contact.workspace_name)) {
      contactsByWorkspace.set(contact.workspace_name, []);
    }
    contactsByWorkspace.get(contact.workspace_name).push(contact);
  }

  for (const [workspaceName, contacts] of contactsByWorkspace.entries()) {
    const wsConfig = workspaceMap.get(workspaceName.toLowerCase());

    if (!wsConfig) {
      console.log(`⚠️  Workspace not found in registry: ${workspaceName}`);
      continue;
    }

    console.log(`\n📨 Checking ${workspaceName} (${contacts.length} contacts)...`);

    const apiKey = wsConfig.bison_api_key || (wsConfig.bison_instance === 'Maverick' ? MAVERICK_API_KEY : LONGRUN_API_KEY);
    const baseUrl = wsConfig.bison_instance === 'Maverick'
      ? 'https://send.maverickmarketingllc.com/api'
      : 'https://send.longrun.agency/api';

    // Switch workspace if using super-admin key
    if (!wsConfig.bison_api_key) {
      const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ team_id: wsConfig.bison_workspace_id }),
      });

      if (!switchResponse.ok) {
        console.log(`   ❌ Failed to switch workspace`);
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Fetch interested replies for this workspace
    const repliesResponse = await fetch(
      `${baseUrl}/replies?status=interested&per_page=1000`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!repliesResponse.ok) {
      console.log(`   ❌ Failed to fetch replies`);
      continue;
    }

    const repliesData = await repliesResponse.json();
    const replies = repliesData.data || [];

    console.log(`   Found ${replies.length} total interested replies`);

    // Match our contacts with the replies
    for (const contact of contacts) {
      const matchingReply = replies.find((r: any) =>
        r.from_email_address?.toLowerCase() === contact.email.toLowerCase()
      );

      if (matchingReply) {
        console.log(`   ✅ Found: ${contact.email}`);

        const domain = wsConfig.bison_instance === 'Maverick'
          ? 'send.maverickmarketingllc.com'
          : 'send.longrun.agency';

        const nameParts = (matchingReply.from_name || '').split(' ');

        results.push({
          workspace_name: workspaceName,
          lead_email: matchingReply.from_email_address,
          first_name: nameParts[0] || null,
          last_name: nameParts.slice(1).join(' ') || null,
          pipeline_stage: 'interested',
          interested: true,
          date_received: matchingReply.date_received || new Date().toISOString(),
          bison_reply_id: matchingReply.id,
          bison_reply_uuid: matchingReply.uuid || null,
          bison_lead_id: matchingReply.lead_id?.toString() || null,
          bison_conversation_url: matchingReply.lead_id
            ? `https://${domain}/leads/${matchingReply.lead_id}`
            : null,
          airtable_id: `bison_reply_${matchingReply.id}`,
          last_synced_at: new Date().toISOString(),
        });
      } else {
        console.log(`   ❌ Not found: ${contact.email}`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

async function insertMissingContacts(contacts: any[]) {
  if (contacts.length === 0) {
    console.log('\n⚠️  No contacts to insert.');
    return;
  }

  console.log(`\n📝 Inserting ${contacts.length} contacts into client_leads table...\n`);

  const { data, error } = await supabase
    .from('client_leads')
    .upsert(contacts, {
      onConflict: 'workspace_name,lead_email',
      ignoreDuplicates: false,
    })
    .select();

  if (error) {
    console.error('❌ Error inserting contacts:', error);
    return;
  }

  console.log(`✅ Successfully inserted ${data?.length || 0} contacts\n`);

  for (const contact of contacts) {
    console.log(`   ✓ ${contact.lead_email} → ${contact.workspace_name}`);
  }
}

async function main() {
  console.log('🚀 Missing Contacts Investigation\n');
  console.log('═'.repeat(100));

  // Step 1: Check database
  const { missing, existing } = await checkMissingContacts() || { missing: [], existing: [] };

  // Step 2: Fetch from Email Bison
  const bisonContacts = await fetchFromEmailBison();

  // Step 3: Insert missing contacts
  if (bisonContacts.length > 0) {
    await insertMissingContacts(bisonContacts);
  }

  console.log('\n✨ Investigation complete!\n');
}

main().catch(console.error);
