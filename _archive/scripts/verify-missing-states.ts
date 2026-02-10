import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMissingStates() {
  console.log('\n🗺️  Verifying FL, IA, AL, MS ZIP Assignments\n');

  const { data, error } = await supabase
    .from('client_zipcodes')
    .select('state, workspace_name, zip')
    .eq('month', 'active')
    .in('state', ['FL', 'IA', 'AL', 'MS'])
    .order('state', { ascending: true })
    .order('workspace_name', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Group by state
  const byState: Record<string, { agencies: Set<string>, zips: string[] }> = {};

  data.forEach(row => {
    if (!byState[row.state]) {
      byState[row.state] = { agencies: new Set(), zips: [] };
    }
    byState[row.state].agencies.add(row.workspace_name);
    byState[row.state].zips.push(row.zip);
  });

  console.log('State Breakdown:');
  console.log('━'.repeat(80));

  let totalZips = 0;
  ['FL', 'IA', 'AL', 'MS'].forEach(state => {
    if (byState[state]) {
      const zipCount = byState[state].zips.length;
      const agencies = Array.from(byState[state].agencies).join(', ');
      console.log(`${state}: ${zipCount} ZIPs assigned to: ${agencies}`);
      totalZips += zipCount;
    } else {
      console.log(`${state}: No ZIPs assigned`);
    }
  });

  console.log('━'.repeat(80));
  console.log(`Total ZIPs in FL/IA/AL/MS: ${totalZips}`);
  console.log('\n✅ These states should now display on the map after the GeoJSON files were added.\n');
}

verifyMissingStates();
