import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q'
);

const month = process.argv[2] || '2025-11';

async function checkExistingZips() {
  const { data, error, count } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact' })
    .eq('month', month);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📊 Found ${count} ZIPs for month ${month}\n`);

  if (count === 0) {
    console.log('✅ No existing data - safe to import!\n');
    return;
  }

  // Group by agency
  const agencies = {};
  data.forEach(row => {
    const name = row.client_name || row.workspace_name || 'UNKNOWN';
    if (!agencies[name]) {
      agencies[name] = { count: 0, color: row.agency_color, workspace: row.workspace_name };
    }
    agencies[name].count++;
  });

  console.log('Agencies:');
  Object.entries(agencies)
    .sort(([, a], [, b]) => b.count - a.count)
    .forEach(([name, info]) => {
      const color = info.color || 'NO COLOR';
      const workspace = info.workspace ? ` (workspace: ${info.workspace})` : '';
      console.log(`  ${name}${workspace}: ${info.count} ZIPs, color: ${color}`);
    });

  console.log('\n⚠️  Data already exists for this month!');
  console.log('Options:');
  console.log('  1. Delete existing data: node scripts/delete-zips-for-month.mjs ' + month);
  console.log('  2. Use different month: "2025-12"');
  console.log('');
}

checkExistingZips();
