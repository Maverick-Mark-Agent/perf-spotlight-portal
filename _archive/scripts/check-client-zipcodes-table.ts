import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkClientZipcodesTable() {
  console.log('Checking if client_zipcodes table/view exists...\n');

  // Try to query client_zipcodes table
  const { data, error } = await supabase
    .from('client_zipcodes')
    .select('*')
    .eq('month', '2025-11')
    .limit(5);

  if (error) {
    console.error('Error querying client_zipcodes:', error);
    console.log('\nThe client_zipcodes table does not exist.');
    console.log('ZIPs are stored in zip_batch_pulls table instead.');
  } else {
    console.log(`Found ${data?.length || 0} records in client_zipcodes`);
    if (data && data.length > 0) {
      console.log('Sample record:', JSON.stringify(data[0], null, 2));
    }
  }

  // Check what month value the ZIPs have
  const { data: batchData } = await supabase
    .from('zip_batch_pulls')
    .select('month')
    .eq('workspace_name', 'Gregg Blanchard')
    .limit(1);

  console.log('\nGregg Blanchard ZIP batch month:', batchData?.[0]?.month);
}

checkClientZipcodesTable();
