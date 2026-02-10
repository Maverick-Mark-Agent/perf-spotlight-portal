import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKirkKimData() {
  console.log('\n=== Checking Kirk and Kim data in all tables ===\n');

  // Check client_zipcodes
  const { data: kimZips, count: kimZipCount } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact' })
    .eq('workspace_name', 'Kim Wallace');

  console.log(`client_zipcodes - Kim Wallace: ${kimZipCount} rows`);
  if (kimZips && kimZips.length > 0) {
    console.log('Sample:', kimZips[0]);
  }

  const { data: kirkZips, count: kirkZipCount } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact' })
    .eq('workspace_name', 'Kirk Hodgson');

  console.log(`client_zipcodes - Kirk Hodgson: ${kirkZipCount} rows`);
  if (kirkZips && kirkZips.length > 0) {
    console.log('Sample:', kirkZips[0]);
  }

  // Check zip_batch_pulls
  const { data: kimPulls, count: kimPullCount } = await supabase
    .from('zip_batch_pulls')
    .select('*', { count: 'exact' })
    .eq('workspace_name', 'Kim Wallace');

  console.log(`\nzip_batch_pulls - Kim Wallace: ${kimPullCount} rows`);

  const { data: kirkPulls, count: kirkPullCount } = await supabase
    .from('zip_batch_pulls')
    .select('*', { count: 'exact' })
    .eq('workspace_name', 'Kirk Hodgson');

  console.log(`zip_batch_pulls - Kirk Hodgson: ${kirkPullCount} rows`);
}

checkKirkKimData();
