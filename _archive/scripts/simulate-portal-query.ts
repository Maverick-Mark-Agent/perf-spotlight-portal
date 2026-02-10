import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulatePortalQuery() {
  console.log('=== SIMULATING CLIENT PORTAL QUERY ===\n');

  const workspace = 'David Amiri';

  console.log(`Testing exact query that ClientPortalPage.tsx uses...`);
  console.log(`Workspace: "${workspace}"\n`);

  // This is the EXACT query from ClientPortalPage.tsx line 434-443
  let query = supabase
    .from('client_leads')
    .select('*')
    .eq('interested', true) // Only fetch interested leads
    .order('date_received', { ascending: false })
    .range(0, 9999); // Fetch up to 10,000 leads

  query = query.eq('workspace_name', workspace);

  const { data, error } = await query;

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  console.log(`✓ Query successful!`);
  console.log(`Total leads returned: ${data?.length || 0}\n`);

  if (data && data.length > 0) {
    console.log('Last 10 leads:');
    data.slice(0, 10).forEach((lead, i) => {
      console.log(`  ${i + 1}. ${lead.date_received} - ${lead.first_name} ${lead.last_name} (${lead.pipeline_stage})`);
    });

    // Count by pipeline stage
    const byStage: Record<string, number> = {};
    data.forEach(lead => {
      byStage[lead.pipeline_stage] = (byStage[lead.pipeline_stage] || 0) + 1;
    });

    console.log('\nLeads by pipeline stage:');
    Object.entries(byStage).forEach(([stage, count]) => {
      console.log(`  ${stage}: ${count}`);
    });

    // Leads since Oct 12
    const recentLeads = data.filter(l => new Date(l.date_received) >= new Date('2025-10-12'));
    console.log(`\nLeads since Oct 12: ${recentLeads.length}`);
    recentLeads.forEach((lead, i) => {
      console.log(`  ${i + 1}. ${lead.date_received} - ${lead.first_name} ${lead.last_name}`);
    });
  } else {
    console.log('⚠️  No leads returned by query!');
    console.log('\nPossible causes:');
    console.log('1. Workspace name mismatch');
    console.log('2. All leads have interested=false');
    console.log('3. RLS policy blocking access');
  }

  // Test with different workspace name variations
  console.log('\n\n=== TESTING WORKSPACE NAME VARIATIONS ===\n');

  const variations = [
    'David Amiri',
    'david amiri',
    'DAVID AMIRI',
    'David  Amiri', // double space
  ];

  for (const variant of variations) {
    const { data: testData } = await supabase
      .from('client_leads')
      .select('id')
      .eq('workspace_name', variant)
      .limit(1);

    console.log(`"${variant}": ${testData?.length || 0} leads found`);
  }

  // Check what workspace names actually exist
  console.log('\n\n=== ACTUAL WORKSPACE NAMES IN client_leads ===\n');
  const { data: workspaces } = await supabase
    .from('client_leads')
    .select('workspace_name')
    .limit(1000);

  const uniqueWorkspaces = [...new Set(workspaces?.map(w => w.workspace_name) || [])].sort();
  console.log('Unique workspace names:');
  uniqueWorkspaces.forEach((ws, i) => {
    console.log(`  ${i + 1}. "${ws}"`);
  });
}

simulatePortalQuery().catch(console.error);
