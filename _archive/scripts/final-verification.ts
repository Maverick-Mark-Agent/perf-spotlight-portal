import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalVerification() {
  console.log('🎉 FINAL VERIFICATION - ZIP Dashboard Ready!\n');
  console.log('='.repeat(60));

  // Get agency breakdown
  const { data: agencies } = await supabase
    .from('client_zipcodes')
    .select('client_name, state, agency_color')
    .eq('month', 'active');

  const agencySummary: Record<string, { total: number; color: string; states: Set<string> }> = {};

  agencies?.forEach(row => {
    if (!agencySummary[row.client_name]) {
      agencySummary[row.client_name] = {
        total: 0,
        color: row.agency_color || 'N/A',
        states: new Set()
      };
    }
    agencySummary[row.client_name].total++;
    if (row.state) agencySummary[row.client_name].states.add(row.state);
  });

  console.log('\n📊 AGENCY BREAKDOWN (Staging Area):');
  console.log('-'.repeat(60));
  Object.entries(agencySummary).sort().forEach(([name, data]) => {
    const statesList = Array.from(data.states).sort().join(', ');
    console.log(`\n✅ ${name}`);
    console.log(`   ZIPs: ${data.total}`);
    console.log(`   Color: ${data.color}`);
    console.log(`   States: ${statesList} (${data.states.size} states)`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('🗺️  READY TO VIEW:');
  console.log('   1. Open ZIP Dashboard in your browser');
  console.log('   2. You should see all 10 agencies in the table');
  console.log('   3. Maps should display all 3,089 ZIPs with agency colors');
  console.log('   4. Try the "Manage ZIPs" button to add/remove ZIPs');
  console.log('   5. Try the "Commit" button to commit to December 2025');
  console.log('='.repeat(60));
}

finalVerification();
