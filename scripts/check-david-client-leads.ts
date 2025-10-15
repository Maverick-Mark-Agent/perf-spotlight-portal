import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDavidClientLeads() {
  console.log('=== DAVID AMIRI CLIENT_LEADS CHECK ===\n');

  // 1. Get all leads for David Amiri
  console.log('1. Querying client_leads for David Amiri...');
  const { data: allLeads, error: allError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'David Amiri')
    .order('date_received', { ascending: false });

  if (allError) {
    console.error('Error querying client_leads:', allError);
    return;
  }

  console.log(`Total leads found: ${allLeads?.length || 0}`);

  if (!allLeads || allLeads.length === 0) {
    console.log('\n❌ No leads found for David Amiri in client_leads table!');
    console.log('This explains why the client portal shows no leads.');
    return;
  }

  // 2. Show last 20 leads
  console.log('\nLast 20 leads:');
  allLeads.slice(0, 20).forEach((lead, i) => {
    console.log(`  ${i + 1}. ${lead.date_received} - ${lead.first_name} ${lead.last_name} (${lead.lead_email})`);
  });

  // 3. Find last lead date
  const lastLead = allLeads[0];
  const lastLeadDate = new Date(lastLead.date_received);
  const daysSince = Math.floor((Date.now() - lastLeadDate.getTime()) / (1000 * 60 * 60 * 24));

  console.log(`\n📊 Last lead received:`);
  console.log(`  Date: ${lastLead.date_received}`);
  console.log(`  Name: ${lastLead.first_name} ${lastLead.last_name}`);
  console.log(`  Days since: ${daysSince}`);

  // 4. Count leads by date range
  const oct12Leads = allLeads.filter(l => new Date(l.date_received) >= new Date('2025-10-12')).length;
  const oct13Leads = allLeads.filter(l => new Date(l.date_received) >= new Date('2025-10-13')).length;
  const oct14Leads = allLeads.filter(l => new Date(l.date_received) >= new Date('2025-10-14')).length;

  console.log(`\nLeads by date:`);
  console.log(`  Since Oct 12: ${oct12Leads}`);
  console.log(`  Since Oct 13: ${oct13Leads}`);
  console.log(`  Since Oct 14 (today): ${oct14Leads}`);

  // 5. Show leads from Oct 12 onwards
  const recentLeads = allLeads.filter(l => new Date(l.date_received) >= new Date('2025-10-12'));
  if (recentLeads.length > 0) {
    console.log(`\nAll leads since Oct 12 (${recentLeads.length} total):`);
    recentLeads.forEach((lead, i) => {
      console.log(`  ${i + 1}. ${lead.date_received} - ${lead.first_name} ${lead.last_name}`);
    });
  } else {
    console.log(`\n⚠️  NO LEADS since Oct 12! This confirms the issue.`);
  }

  // 6. Check last_synced_at to see when data was last pulled
  console.log(`\nLast sync times for recent leads:`);
  allLeads.slice(0, 5).forEach((lead, i) => {
    console.log(`  ${i + 1}. Lead from ${lead.date_received}, last_synced_at: ${lead.last_synced_at}`);
  });

  // 7. Check all clients to see if this is widespread
  console.log('\n\n=== CHECKING ALL CLIENT PORTAL CLIENTS ===\n');

  const { data: allClients } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id')
    .not('bison_workspace_id', 'is', null)
    .order('workspace_name');

  if (allClients) {
    for (const client of allClients) {
      const { data: leads } = await supabase
        .from('client_leads')
        .select('date_received')
        .eq('workspace_name', client.workspace_name)
        .order('date_received', { ascending: false })
        .limit(1);

      if (leads && leads.length > 0) {
        const daysSince = Math.floor((Date.now() - new Date(leads[0].date_received).getTime()) / (1000 * 60 * 60 * 24));
        const flag = daysSince > 2 ? '⚠️' : '✓';
        console.log(`  ${flag} ${client.workspace_name.padEnd(30)} Last lead: ${leads[0].date_received} (${daysSince}d ago)`);
      } else {
        console.log(`  ❌ ${client.workspace_name.padEnd(30)} No leads found`);
      }
    }
  }

  console.log('\n=== END CHECK ===');
}

checkDavidClientLeads().catch(console.error);
