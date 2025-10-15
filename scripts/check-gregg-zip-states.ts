import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkGreggZipStates() {
  console.log('Checking state values for Gregg Blanchard ZIPs...\n');

  const { data, error } = await supabase
    .from('client_zipcodes')
    .select('zip, state, client_name, agency_color')
    .eq('client_name', 'Gregg Blanchard')
    .eq('month', '2025-11')
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Sample ZIPs for Gregg Blanchard:`);
    data?.forEach(zip => {
      console.log(`  ZIP: ${zip.zip}, State: ${zip.state === null ? 'NULL' : zip.state}, Color: ${zip.agency_color}`);
    });

    // Count how many have null state
    const nullStateCount = data?.filter(z => z.state === null).length || 0;
    const hasStateCount = data?.filter(z => z.state !== null).length || 0;

    console.log(`\nOut of ${data?.length || 0} sample ZIPs:`);
    console.log(`  - NULL state: ${nullStateCount}`);
    console.log(`  - Has state: ${hasStateCount}`);
  }

  // Check if any Gregg Blanchard ZIPs have states
  const { count: totalCount } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('client_name', 'Gregg Blanchard')
    .eq('month', '2025-11');

  const { count: nullStateCount } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('client_name', 'Gregg Blanchard')
    .eq('month', '2025-11')
    .is('state', null);

  console.log(`\nTotal stats for all ${totalCount} Gregg Blanchard ZIPs:`);
  console.log(`  - NULL state: ${nullStateCount}`);
  console.log(`  - Has state: ${totalCount! - nullStateCount!}`);

  // Look up what state these ZIPs should be
  console.log('\n--- Looking up ZIP code 33301 (should be Florida) ---');
  const floridaZips = ['33301', '33304', '33305'];
  console.log('These are Fort Lauderdale, FL ZIP codes');
  console.log('The state field should be "FL" but is currently NULL');
}

checkGreggZipStates();
