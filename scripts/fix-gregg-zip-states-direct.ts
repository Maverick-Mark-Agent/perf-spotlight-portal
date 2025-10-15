import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixGreggZipStatesDirect() {
  console.log('Attempting to fix state values with direct update...\n');

  // Try a single bulk update for all Gregg Blanchard ZIPs in 2025-11
  // Florida ZIPs start with 33
  const { data, error } = await supabase
    .from('client_zipcodes')
    .update({ state: 'FL' })
    .eq('client_name', 'Gregg Blanchard')
    .eq('month', '2025-11')
    .like('zip', '33%')
    .select();

  if (error) {
    console.error('Error updating ZIPs:', error);
    console.log('\nPossible issue: Row-level security might be blocking updates');
    console.log('The anon key might not have permission to update client_zipcodes');
  } else {
    console.log(`✓ Successfully updated ${data?.length || 0} ZIPs to state FL`);
    if (data && data.length > 0) {
      console.log('Sample updated ZIP:', data[0]);
    }
  }

  // Verify
  const { data: verifyData, count } = await supabase
    .from('client_zipcodes')
    .select('zip, state', { count: 'exact' })
    .eq('client_name', 'Gregg Blanchard')
    .eq('month', '2025-11')
    .eq('state', 'FL')
    .limit(5);

  console.log(`\nVerification: Found ${count || 0} ZIPs with state = FL`);
  if (verifyData && verifyData.length > 0) {
    console.log('Sample ZIPs with FL state:', verifyData);
  }
}

fixGreggZipStatesDirect();
