import { createClient } from '@supabase/supabase-js';
import { getStateFromZip } from '../src/utils/zipStateMapping';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllZipStates() {
  console.log('🔧 Fixing ALL ZIP states in staging area...\n');

  // Get all ZIPs without state in staging
  const { data: zipsWithoutState, error } = await supabase
    .from('client_zipcodes')
    .select('id, zip, client_name')
    .eq('month', 'active')
    .is('state', null);

  if (error) throw error;

  console.log(`Found ${zipsWithoutState?.length || 0} ZIPs without states\n`);

  if (!zipsWithoutState || zipsWithoutState.length === 0) {
    console.log('✅ All ZIPs already have states!');
    return;
  }

  // Group by client for progress tracking
  const byClient = zipsWithoutState.reduce((acc, row) => {
    if (!acc[row.client_name]) acc[row.client_name] = 0;
    acc[row.client_name]++;
    return acc;
  }, {} as Record<string, number>);

  console.log('ZIPs missing states by client:');
  Object.entries(byClient).forEach(([client, count]) => {
    console.log(`  ${client}: ${count} ZIPs`);
  });
  console.log('');

  let updated = 0;
  let failed = 0;

  for (const row of zipsWithoutState) {
    const state = getStateFromZip(row.zip);
    if (state) {
      const { error: updateError } = await supabase
        .from('client_zipcodes')
        .update({ state })
        .eq('id', row.id);

      if (!updateError) {
        updated++;
        if (updated % 50 === 0) {
          console.log(`  ✓ Updated ${updated}/${zipsWithoutState.length} ZIPs...`);
        }
      } else {
        failed++;
        console.error(`  ❌ Error updating ${row.zip}:`, updateError.message);
      }
    } else {
      console.warn(`  ⚠️  Could not map ZIP ${row.zip} to a state`);
    }
  }

  console.log(`\n✅ Update complete!`);
  console.log(`   - Updated: ${updated} ZIPs`);
  console.log(`   - Failed: ${failed} ZIPs`);

  // Verify final state
  console.log('\n📊 Verification:');
  const { count: totalStaging } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('month', 'active');

  const { count: withState } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('month', 'active')
    .not('state', 'is', null);

  const { count: withoutState } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('month', 'active')
    .is('state', null);

  console.log(`   Total ZIPs in staging: ${totalStaging}`);
  console.log(`   ZIPs with state: ${withState}`);
  console.log(`   ZIPs without state: ${withoutState}`);

  // Check Kim Wallace specifically
  const { count: kimWithState } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('month', 'active')
    .eq('client_name', 'Kim Wallace')
    .not('state', 'is', null);

  console.log(`\n✅ Kim Wallace: ${kimWithState} ZIPs now have states`);
}

fixAllZipStates();
