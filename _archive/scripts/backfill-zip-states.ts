import { createClient } from '@supabase/supabase-js';
import { getStateFromZip } from '../src/utils/zipStateMapping';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillZipStates() {
  console.log('🔄 Backfilling missing states for all ZIPs in staging area...\n');

  try {
    // Step 1: Fetch all ZIPs with null state from staging
    console.log('📥 Fetching ZIPs with missing states...');
    const { data: zipsWithoutState, error: fetchError } = await supabase
      .from('client_zipcodes')
      .select('id, zip, client_name')
      .eq('month', 'active')
      .is('state', null);

    if (fetchError) throw fetchError;

    if (!zipsWithoutState || zipsWithoutState.length === 0) {
      console.log('✅ All ZIPs already have states assigned!');
      return;
    }

    console.log(`📊 Found ${zipsWithoutState.length} ZIPs missing states\n`);

    // Step 2: Map each ZIP to its state
    console.log('🗺️  Mapping ZIPs to states...');
    const updates = zipsWithoutState.map(row => ({
      id: row.id,
      zip: row.zip,
      state: getStateFromZip(row.zip),
      client_name: row.client_name,
    }));

    // Count how many will be mapped vs not found
    const mapped = updates.filter(u => u.state !== null).length;
    const notFound = updates.filter(u => u.state === null).length;

    console.log(`   ✓ ${mapped} ZIPs will be mapped to states`);
    if (notFound > 0) {
      console.log(`   ⚠️  ${notFound} ZIPs have unknown states (will remain null)`);
    }
    console.log('');

    // Step 3: Update in batches
    console.log('💾 Updating database...');
    let updated = 0;
    const batchSize = 100;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      // Update each record
      for (const update of batch) {
        if (update.state) {
          const { error: updateError } = await supabase
            .from('client_zipcodes')
            .update({ state: update.state })
            .eq('id', update.id);

          if (updateError) {
            console.error(`   ❌ Error updating ZIP ${update.zip}:`, updateError.message);
          } else {
            updated++;
          }
        }
      }

      console.log(`   ✓ Processed ${Math.min(i + batchSize, updates.length)}/${updates.length} ZIPs`);
    }

    console.log('\n✅ Backfill complete!');
    console.log(`\n📊 Final Summary:`);
    console.log(`   - ${updated} ZIPs updated with states`);
    console.log(`   - ${notFound} ZIPs could not be mapped (unknown ZIP prefixes)`);

    // Show sample of updated data
    console.log('\n📋 Sample of updated data:');
    const { data: sample } = await supabase
      .from('client_zipcodes')
      .select('zip, state, client_name')
      .eq('month', 'active')
      .not('state', 'is', null)
      .limit(10);

    console.table(sample);

  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error.message);
    process.exit(1);
  }
}

backfillZipStates();
