import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

const MAVERICK_API_KEY = process.env.EMAIL_BISON_API_KEY || '';
const LONGRUN_API_KEY = process.env.LONG_RUN_BISON_API_KEY || '';

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

interface LeadData {
  id: number;
  workspace_name: string;
  lead_email: string;
  bison_lead_id: string | null;
  bison_conversation_url: string | null;
  custom_variables: any;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

async function fetchCompleteLeadData() {
  console.log('🔍 Fetching complete lead data from Email Bison...\n');
  console.log('═'.repeat(120));

  // Get current contacts from database
  const { data: contacts, error: dbError } = await supabase
    .from('client_leads')
    .select('id, workspace_name, lead_email, bison_lead_id, bison_conversation_url, custom_variables, phone, address, city, state, zip')
    .in('lead_email', targetEmails);

  if (dbError || !contacts) {
    console.error('❌ Error fetching contacts:', dbError);
    return;
  }

  console.log(`Found ${contacts.length} contacts in database\n`);

  // Get workspace configurations
  const { data: workspaces, error: wsError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
    .eq('is_active', true);

  if (wsError || !workspaces) {
    console.error('❌ Error fetching workspaces:', wsError);
    return;
  }

  const workspaceMap = new Map();
  for (const ws of workspaces) {
    workspaceMap.set(ws.workspace_name.toLowerCase(), ws);
  }

  const updatedContacts = [];

  for (const contact of contacts) {
    console.log(`\n📧 Processing: ${contact.lead_email} (${contact.workspace_name})`);

    if (!contact.bison_lead_id) {
      console.log('   ⚠️  No bison_lead_id - skipping');
      continue;
    }

    const wsConfig = workspaceMap.get(contact.workspace_name.toLowerCase());
    if (!wsConfig) {
      console.log('   ❌ Workspace not found in registry');
      continue;
    }

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
        console.log('   ❌ Failed to switch workspace');
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Fetch full lead details
    try {
      const leadResponse = await fetch(`${baseUrl}/leads/${contact.bison_lead_id}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!leadResponse.ok) {
        console.log(`   ❌ Failed to fetch lead (status ${leadResponse.status})`);

        // Check if lead exists at all
        if (leadResponse.status === 404) {
          console.log('   ⚠️  Lead not found - may have been deleted or ID is wrong');
        }
        continue;
      }

      const leadData = await leadResponse.json();
      const lead = leadData.data;

      console.log('   ✅ Fetched lead data');

      // Extract phone from custom variables if not directly available
      const phoneVariable = lead.custom_variables?.find((v: any) =>
        v.name?.toLowerCase().includes('phone')
      );

      // Build correct conversation URL
      const domain = wsConfig.bison_instance === 'Maverick'
        ? 'send.maverickmarketingllc.com'
        : 'send.longrun.agency';

      const conversationUrl = `https://${domain}/workspaces/${wsConfig.bison_workspace_id}/leads/${contact.bison_lead_id}`;

      const updatedData = {
        id: contact.id,
        phone: lead.phone || phoneVariable?.value || null,
        address: lead.address || null,
        city: lead.city || null,
        state: lead.state || null,
        zip: lead.zip || null,
        company: lead.company || null,
        title: lead.title || null,
        birthday: lead.birthday || null,
        renewal_date: lead.renewal_date || null,
        custom_variables: lead.custom_variables || null,
        tags: lead.tags || null,
        bison_conversation_url: conversationUrl,
      };

      console.log(`   📍 Updated URL: ${conversationUrl}`);
      console.log(`   📞 Phone: ${updatedData.phone || 'N/A'}`);
      console.log(`   🏠 Address: ${updatedData.address || 'N/A'}, ${updatedData.city || 'N/A'}, ${updatedData.state || 'N/A'} ${updatedData.zip || 'N/A'}`);
      console.log(`   📋 Custom Variables: ${updatedData.custom_variables?.length || 0} variables`);

      if (updatedData.custom_variables && updatedData.custom_variables.length > 0) {
        for (const cv of updatedData.custom_variables) {
          console.log(`      • ${cv.name}: ${cv.value}`);
        }
      }

      updatedContacts.push(updatedData);

      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      console.error(`   ❌ Error fetching lead: ${error.message}`);
    }
  }

  console.log('\n═'.repeat(120));
  console.log(`\n📊 Summary: Fetched complete data for ${updatedContacts.length}/${contacts.length} contacts\n`);

  if (updatedContacts.length > 0) {
    console.log('💾 Updating database...\n');

    for (const update of updatedContacts) {
      const { id, ...updateData } = update;

      const { error: updateError } = await supabase
        .from('client_leads')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error(`❌ Failed to update ${id}:`, updateError.message);
      } else {
        console.log(`✅ Updated contact ID ${id}`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n✨ Database update complete!\n');
  }

  return updatedContacts;
}

async function main() {
  console.log('🚀 Complete Lead Data Fetch & Update\n');
  console.log('This will fetch ALL lead data from Email Bison and update the database\n');

  await fetchCompleteLeadData();

  console.log('═'.repeat(120));
  console.log('\n✅ Done! All contacts should now have:');
  console.log('   • Correct Email Bison conversation URLs');
  console.log('   • Complete custom variables');
  console.log('   • Phone numbers, addresses, and other fields');
  console.log('   • All data visible in the client portal\n');
}

main().catch(console.error);
