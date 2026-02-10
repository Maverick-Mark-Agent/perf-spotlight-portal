import { createClient } from '@supabase/supabase-js';
import { getStateFromZip } from './zip-to-state.mjs';
import fsSync from 'fs';

// Attempt to auto-load .env if envs are missing
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const envText = fsSync.readFileSync('.env', 'utf8');
    envText.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        let val = m[2];
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  } catch {}
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  try {
    console.log('\n🔄 Backfilling state data for existing ZIP codes...\n');

    // Get all ZIPs with null state
    let allZips = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('client_zipcodes')
        .select('id, zip, state')
        .is('state', null)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allZips = allZips.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    console.log(`📊 Found ${allZips.length} ZIP codes with null state\n`);

    if (allZips.length === 0) {
      console.log('✅ No backfill needed - all states already populated\n');
      return;
    }

    // Update in batches
    const BATCH_SIZE = 100;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < allZips.length; i += BATCH_SIZE) {
      const batch = allZips.slice(i, i + BATCH_SIZE);

      // Update each record individually with calculated state
      const promises = batch.map(async (record) => {
        const state = getStateFromZip(record.zip);
        if (!state) {
          console.warn(`⚠️  Could not determine state for ZIP: ${record.zip}`);
          failed++;
          return;
        }

        const { error } = await supabase
          .from('client_zipcodes')
          .update({ state })
          .eq('id', record.id);

        if (error) {
          console.error(`❌ Failed to update ZIP ${record.zip}:`, error.message);
          failed++;
        } else {
          updated++;
        }
      });

      await Promise.all(promises);
      console.log(`   ✓ Processed ${Math.min(i + BATCH_SIZE, allZips.length)}/${allZips.length} records...`);
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}\n`);

  } catch (error) {
    console.error('\n❌ Backfill failed:', error.message || error);
    console.error('Full error:', error);
    process.exit(1);
  }
})();
