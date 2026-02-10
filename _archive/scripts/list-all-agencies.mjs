import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q'
);

const month = process.argv[2] || '2025-11';

async function listAllAgencies() {
  // Get ALL rows (remove default 1000 limit)
  let allData = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('client_zipcodes')
      .select('client_name, workspace_name, agency_color')
      .eq('month', month)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const data = allData;

  const agencies = {};
  data.forEach(row => {
    const key = row.workspace_name || row.client_name;
    if (!agencies[key]) {
      agencies[key] = {
        client_name: row.client_name,
        workspace_name: row.workspace_name,
        color: row.agency_color,
        count: 0
      };
    }
    agencies[key].count++;
  });

  console.log(`\n📊 All agencies for month ${month}:\n`);
  Object.entries(agencies)
    .sort(([, a], [, b]) => b.count - a.count)
    .forEach(([key, info]) => {
      console.log(`${info.workspace_name || info.client_name}`);
      console.log(`  Client Name: ${info.client_name}`);
      console.log(`  Workspace: ${info.workspace_name || 'null'}`);
      console.log(`  Color: ${info.color || 'NO COLOR'}`);
      console.log(`  ZIPs: ${info.count}\n`);
    });

  console.log(`Total unique agencies: ${Object.keys(agencies).length}`);
  console.log(`Total ZIPs: ${data.length}\n`);
}

listAllAgencies();
