import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDevinHodo() {
  console.log('\n=== Checking Devin Hodo Data ===\n');

  // Check client_registry
  const { data: client } = await supabase
    .from('client_registry')
    .select('*')
    .ilike('display_name', '%Devin%')
    .single();

  if (client) {
    console.log('Client Registry:');
    console.log(`  Display Name: ${client.display_name}`);
    console.log(`  Workspace Name: ${client.workspace_name}`);
    console.log(`  Client Type: ${client.client_type}`);
    console.log(`  Active: ${client.is_active}`);
  } else {
    console.log('❌ Client not found in registry');
    return;
  }

  // Check ZIP assignments by month
  const { data: zips } = await supabase
    .from('client_zipcodes')
    .select('month, count')
    .eq('workspace_name', client.workspace_name)
    .order('month');

  console.log('\nZIP Assignments by Month:');
  if (zips && zips.length > 0) {
    for (const row of zips) {
      const { count } = await supabase
        .from('client_zipcodes')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_name', client.workspace_name)
        .eq('month', row.month);

      console.log(`  ${row.month}: ${count} ZIPs`);
    }
  } else {
    console.log('  No ZIP assignments found');
  }

  // Check December specifically
  const { data: decZips, count: decCount } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact' })
    .eq('workspace_name', client.workspace_name)
    .eq('month', '2025-12');

  console.log(`\nDecember 2025: ${decCount || 0} ZIPs`);
  if (decZips && decZips.length > 0) {
    console.log('Sample:', decZips[0]);
  }
}

checkDevinHodo();
