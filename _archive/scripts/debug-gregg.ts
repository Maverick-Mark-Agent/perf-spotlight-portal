import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugGregg() {
  console.log('\n=== Gregg Blanchard Current State ===\n');

  // Check client_registry
  const { data: client, error: clientError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, client_type, agency_color, is_active')
    .ilike('display_name', '%Gregg%')
    .single();

  if (clientError) {
    console.error('Error fetching client:', clientError);
    return;
  }

  console.log('Client Registry:');
  console.log(JSON.stringify(client, null, 2));

  // Check client_zipcodes
  const { data: zips, error: zipError } = await supabase
    .from('client_zipcodes')
    .select('*')
    .eq('workspace_name', client.workspace_name);

  console.log('\n\nZIP Entries:');
  if (zips && zips.length > 0) {
    console.log(`Found ${zips.length} entries:`);
    zips.forEach(z => {
      console.log(`  - ZIP: ${z.zip}, Month: ${z.month}, Color: ${z.agency_color}`);
    });
  } else {
    console.log('❌ NO ZIP ENTRIES FOUND');
    console.log('\nThis is why Gregg does not appear in ZIP Dashboard!');
  }

  // Check what ZIP Dashboard queries
  console.log('\n\n=== Testing ZIP Dashboard Query ===\n');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: dashboardData, error: dashError } = await supabase
    .from('client_zipcodes')
    .select('*')
    .eq('month', currentMonth)
    .eq('workspace_name', client.workspace_name);

  console.log(`Query for month ${currentMonth}:`);
  if (dashboardData && dashboardData.length > 0) {
    console.log(`✅ Found ${dashboardData.length} entries`);
  } else {
    console.log('❌ No entries found for current month');
  }
}

debugGregg();
