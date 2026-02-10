import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKimNovember() {
  console.log('\n=== Checking Kim Wallace November 2025 ===\n');

  const { data: zips, count } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact' })
    .eq('workspace_name', 'Kim Wallace')
    .eq('month', '2025-11');

  console.log(`Total ZIPs assigned: ${count}`);

  if (zips && zips.length > 0) {
    console.log('Sample ZIP:', zips[0]);
    console.log('States:', [...new Set(zips.map(z => z.state))].join(', '));
  } else {
    console.log('❌ No ZIPs found for Kim Wallace in November 2025');
  }
}

checkKimNovember();
