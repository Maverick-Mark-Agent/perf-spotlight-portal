import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q'
);

const month = process.argv[2];

if (!month) {
  console.error('Usage: node scripts/delete-zips-for-month.mjs <YYYY-MM>');
  process.exit(1);
}

async function deleteZipsForMonth() {
  console.log(`\n🗑️  Deleting all ZIPs for month ${month}...\n`);

  const { data: existing, count } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact' })
    .eq('month', month);

  if (count === 0) {
    console.log('✅ No data found for this month - nothing to delete\n');
    return;
  }

  console.log(`📊 Found ${count} ZIPs to delete`);

  const { error } = await supabase
    .from('client_zipcodes')
    .delete()
    .eq('month', month);

  if (error) {
    console.error('❌ Delete failed:', error);
    process.exit(1);
  }

  console.log(`✅ Successfully deleted ${count} ZIPs for month ${month}\n`);
}

deleteZipsForMonth();
