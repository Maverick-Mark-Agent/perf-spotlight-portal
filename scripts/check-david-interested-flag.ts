import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInterestedFlag() {
  console.log('=== CHECKING INTERESTED FLAG FOR DAVID AMIRI ===\n');

  // Get all David Amiri leads
  const { data: allLeads } = await supabase
    .from('client_leads')
    .select('id, first_name, last_name, date_received, interested, pipeline_stage')
    .eq('workspace_name', 'David Amiri')
    .order('date_received', { ascending: false })
    .limit(50);

  if (!allLeads || allLeads.length === 0) {
    console.log('No leads found');
    return;
  }

  console.log(`Total leads: ${allLeads.length}\n`);

  // Count by interested flag
  const interestedCount = allLeads.filter(l => l.interested).length;
  const notInterestedCount = allLeads.filter(l => !l.interested).length;

  console.log(`Interested: ${interestedCount}`);
  console.log(`Not interested: ${notInterestedCount}\n`);

  // Show recent leads and their interested status
  console.log('Recent leads with interested flag:');
  allLeads.slice(0, 20).forEach((lead, i) => {
    const flag = lead.interested ? '✓ YES' : '✗ NO';
    console.log(`  ${i + 1}. [${flag}] ${lead.date_received} - ${lead.first_name} ${lead.last_name} (${lead.pipeline_stage})`);
  });

  // Check leads since Oct 12 specifically
  const recentLeads = allLeads.filter(l => new Date(l.date_received) >= new Date('2025-10-12'));
  console.log(`\n\nLeads since Oct 12: ${recentLeads.length}`);
  recentLeads.forEach((lead, i) => {
    const flag = lead.interested ? '✓ YES' : '✗ NO';
    console.log(`  ${i + 1}. [${flag}] ${lead.date_received} - ${lead.first_name} ${lead.last_name}`);
  });

  console.log('\n=== ROOT CAUSE ===');
  console.log('The client portal filters to ONLY show leads where interested=true.');
  console.log('If recent leads are not marked as interested, they will not appear!');
}

checkInterestedFlag().catch(console.error);
