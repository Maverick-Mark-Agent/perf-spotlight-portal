import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkGreggInClientZipcodes() {
  console.log('Checking if Gregg Blanchard ZIPs are in client_zipcodes table...\n');

  const { data, error, count } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact' })
    .eq('client_name', 'Gregg Blanchard')
    .eq('month', '2025-11');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${count || 0} records for Gregg Blanchard in client_zipcodes for 2025-11`);
    if (data && data.length > 0) {
      console.log('Sample records:');
      data.slice(0, 3).forEach(record => {
        console.log(JSON.stringify(record, null, 2));
      });
    }
  }

  // Check all months
  const { data: allMonths } = await supabase
    .from('client_zipcodes')
    .select('month')
    .eq('client_name', 'Gregg Blanchard');

  if (allMonths && allMonths.length > 0) {
    console.log('\nGregg Blanchard exists in these months:', [...new Set(allMonths.map(m => m.month))]);
  }

  // Check if any record exists for Gregg at all
  const { count: totalCount } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('client_name', 'Gregg Blanchard');

  console.log(`\nTotal Gregg Blanchard records across all months: ${totalCount || 0}`);
}

checkGreggInClientZipcodes();
