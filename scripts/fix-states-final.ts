import { createClient } from '@supabase/supabase-js';
import { getStateFromZip } from '../src/utils/zipStateMapping';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStatesRowByRow() {
  console.log('🔧 Fixing ZIP states row-by-row (bypassing batch limits)...\n');

  // Get all ZIPs without states
  const { data: zipsToFix, error } = await supabase
    .from('client_zipcodes')
    .select('id, zip, client_name')
    .eq('month', 'active')
    .is('state', null);

  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  if (!zipsToFix || zipsToFix.length === 0) {
    console.log('✅ All ZIPs already have states!');
    return;
  }

  console.log(`Found ${zipsToFix.length} ZIPs to update\n`);

  // Update one at a time in small batches
  let updated = 0;
  const batchSize = 10;

  for (let i = 0; i < zipsToFix.length; i += batchSize) {
    const batch = zipsToFix.slice(i, i + batchSize);

    // Process batch in parallel
    const promises = batch.map(async (row) => {
      const state = getStateFromZip(row.zip);
      if (!state) return false;

      // Use upsert with unique constraint
      const { error: upsertError } = await supabase
        .from('client_zipcodes')
        .update({ state })
        .eq('id', row.id)
        .eq('month', 'active'); // Extra filter for safety

      return !upsertError;
    });

    const results = await Promise.all(promises);
    updated += results.filter(r => r).length;

    if ((i + batchSize) % 100 === 0 || i + batchSize >= zipsToFix.length) {
      console.log(`  ✓ Processed ${Math.min(i + batchSize, zipsToFix.length)}/${zipsToFix.length} ZIPs (${updated} updated)`);
    }
  }

  console.log(`\n✅ Completed: ${updated}/${zipsToFix.length} ZIPs updated\n`);

  // Verify
  const { count: kimWithState } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('month', 'active')
    .eq('client_name', 'Kim Wallace')
    .eq('state', 'TX');

  console.log(`✅ Kim Wallace ZIPs with state=TX: ${kimWithState}`);

  // Sample check
  const { data: sample } = await supabase
    .from('client_zipcodes')
    .select('zip, state, client_name')
    .eq('month', 'active')
    .eq('client_name', 'Kim Wallace')
    .limit(5);

  console.log('\nSample Kim Wallace ZIPs:');
  console.table(sample);
}

fixStatesRowByRow();
