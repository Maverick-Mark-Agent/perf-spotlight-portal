import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDavidLeads() {
  console.log('=== DAVID AMIRI CLIENT PORTAL LEAD CHECK ===\n');

  // 1. Get David Amiri's workspace_id from client_registry
  console.log('1. Finding David Amiri in client_registry...');
  const { data: registry, error: regError } = await supabase
    .from('client_registry')
    .select('workspace_id, workspace_name, bison_workspace_id, bison_instance')
    .eq('workspace_name', 'David Amiri')
    .single();

  if (regError || !registry) {
    console.error('Error finding David Amiri:', regError);
    return;
  }

  console.log(`Found: workspace_id=${registry.workspace_id}, bison_workspace_id=${registry.bison_workspace_id}`);

  // 2. Find lead_sources for this client
  console.log('\n2. Checking lead_sources for David Amiri...');
  const { data: sources, error: sourcesError } = await supabase
    .from('lead_sources')
    .select('*')
    .eq('client_id', registry.workspace_id);

  if (sourcesError) {
    console.error('Error querying lead_sources:', sourcesError);
  } else {
    console.log(`Found ${sources?.length || 0} lead sources:`);
    sources?.forEach((s, i) => {
      console.log(`  ${i + 1}. ID: ${s.id}, Site: ${s.site}, Active: ${s.active}, Last run: ${s.last_run_at}`);
    });
  }

  const sourceIds = sources?.map(s => s.id) || [];

  if (sourceIds.length === 0) {
    console.log('\n⚠️  No lead sources configured for David Amiri!');
    console.log('This client needs lead sources set up to receive leads.');
    return;
  }

  // 3. Check raw_leads for these sources
  console.log('\n3. Checking raw_leads...');
  const { data: rawLeads, error: rawError } = await supabase
    .from('raw_leads')
    .select('id, scraped_at, created_at')
    .in('lead_source_id', sourceIds)
    .order('created_at', { ascending: false })
    .limit(20);

  if (rawError) {
    console.error('Error querying raw_leads:', rawError);
  } else {
    console.log(`Found ${rawLeads?.length || 0} raw leads:`);
    rawLeads?.forEach((rl, i) => {
      console.log(`  ${i + 1}. ID: ${rl.id}, Created: ${rl.created_at}`);
    });
  }

  // 4. Check cleaned_leads
  console.log('\n4. Checking cleaned_leads...');

  const rawLeadIds = rawLeads?.map(r => r.id) || [];

  if (rawLeadIds.length > 0) {
    const { data: cleanedLeads, error: cleanError } = await supabase
      .from('cleaned_leads')
      .select('*')
      .in('raw_lead_id', rawLeadIds)
      .order('created_at', { ascending: false });

    if (cleanError) {
      console.error('Error querying cleaned_leads:', cleanError);
    } else {
      console.log(`Found ${cleanedLeads?.length || 0} cleaned leads:`);
      cleanedLeads?.slice(0, 10).forEach((cl, i) => {
        console.log(`  ${i + 1}. ${cl.created_at} - ${cl.first_name} ${cl.last_name} (${cl.email})`);
      });

      if (cleanedLeads && cleanedLeads.length > 0) {
        const lastLead = cleanedLeads[0];
        const daysSince = Math.floor((Date.now() - new Date(lastLead.created_at).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`\n📊 Last lead was ${daysSince} days ago (${lastLead.created_at})`);

        // Count by date
        const oct12 = cleanedLeads.filter(l => new Date(l.created_at) >= new Date('2025-10-12')).length;
        const oct13 = cleanedLeads.filter(l => new Date(l.created_at) >= new Date('2025-10-13')).length;
        const oct14 = cleanedLeads.filter(l => new Date(l.created_at) >= new Date('2025-10-14')).length;

        console.log(`\nLeads by date:`);
        console.log(`  Since Oct 12: ${oct12}`);
        console.log(`  Since Oct 13: ${oct13}`);
        console.log(`  Since Oct 14 (today): ${oct14}`);
      }
    }
  }

  // 5. Check using a complex join query for total count
  console.log('\n5. Running join query for total lead count...');
  const { data: joinData, error: joinError } = await supabase
    .rpc('get_client_leads_count', { client_workspace_id: registry.workspace_id });

  if (joinError) {
    console.log('RPC function not available, trying direct query...');

    // Manual count query
    if (rawLeadIds.length > 0) {
      const { count } = await supabase
        .from('cleaned_leads')
        .select('*', { count: 'exact', head: true })
        .in('raw_lead_id', rawLeadIds);

      console.log(`Total leads for David Amiri: ${count}`);
    }
  } else {
    console.log('Total leads from RPC:', joinData);
  }

  console.log('\n=== END DAVID AMIRI CHECK ===');
}

checkDavidLeads().catch(console.error);
