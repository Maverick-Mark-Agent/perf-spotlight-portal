import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCorrectTable() {
  console.log('Checking correct tables for ZIP assignments...\n');

  // Check client_zip_progress table
  const { data: zipProgress, error: progressError } = await supabase
    .from('client_zip_progress')
    .select('*')
    .eq('client_name', 'Gregg Blanchard')
    .limit(5);

  if (progressError) {
    console.error('Error fetching client_zip_progress:', progressError);
  } else {
    console.log(`Found ${zipProgress?.length || 0} records in client_zip_progress`);
    if (zipProgress && zipProgress.length > 0) {
      console.log('Sample record:', JSON.stringify(zipProgress[0], null, 2));
    }
  }

  // Check zip_batch_pulls table
  const { data: batchPulls, error: batchError } = await supabase
    .from('zip_batch_pulls')
    .select('*')
    .eq('workspace_name', 'Gregg Blanchard')
    .limit(5);

  if (batchError) {
    console.error('Error fetching zip_batch_pulls:', batchError);
  } else {
    console.log(`\nFound ${batchPulls?.length || 0} records in zip_batch_pulls`);
    if (batchPulls && batchPulls.length > 0) {
      console.log('Sample record:', JSON.stringify(batchPulls[0], null, 2));
    }
  }

  // Count all ZIPs for Gregg Blanchard
  const { count: progressCount } = await supabase
    .from('client_zip_progress')
    .select('*', { count: 'exact', head: true })
    .eq('client_name', 'Gregg Blanchard');

  const { count: batchCount } = await supabase
    .from('zip_batch_pulls')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_name', 'Gregg Blanchard');

  console.log(`\nTotal counts:`);
  console.log(`- client_zip_progress: ${progressCount || 0}`);
  console.log(`- zip_batch_pulls: ${batchCount || 0}`);
}

checkCorrectTable();
