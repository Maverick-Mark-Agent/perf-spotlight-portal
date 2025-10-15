import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyExistingContacts() {
  console.log('\n=== Verifying Kim Wallace and Kirk Hodgson Data ===\n');

  // Check Kim Wallace
  const { data: kimZips } = await supabase
    .from('client_zipcodes')
    .select('month, count')
    .eq('workspace_name', 'Kim Wallace')
    .order('month');

  console.log('Kim Wallace ZIP assignments:');
  if (kimZips && kimZips.length > 0) {
    kimZips.forEach((row: any) => {
      console.log(`  ${row.month}: ${row.count || 'N/A'} ZIPs`);
    });
  } else {
    console.log('  No data found');
  }

  // Check Kirk Hodgson
  const { data: kirkZips } = await supabase
    .from('client_zipcodes')
    .select('month, count')
    .eq('workspace_name', 'Kirk Hodgson')
    .order('month');

  console.log('\nKirk Hodgson ZIP assignments:');
  if (kirkZips && kirkZips.length > 0) {
    kirkZips.forEach((row: any) => {
      console.log(`  ${row.month}: ${row.count || 'N/A'} ZIPs`);
    });
  } else {
    console.log('  No data found');
  }

  // Check client_registry
  const { data: clients } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, client_type, is_active')
    .in('workspace_name', ['Kim Wallace', 'Kirk Hodgson']);

  console.log('\nClient Registry:');
  clients?.forEach(c => {
    console.log(`  ${c.display_name}: client_type=${c.client_type}, active=${c.is_active}`);
  });

  console.log('\n✅ All existing data should remain intact');
}

verifyExistingContacts();
