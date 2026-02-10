import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ZIP code to state mapping (3-digit prefix)
const ZIP_PREFIX_TO_STATE: Record<string, string> = {
  // Florida (330-334, 335-349)
  '330': 'FL', '331': 'FL', '332': 'FL', '333': 'FL', '334': 'FL',
  '335': 'FL', '336': 'FL', '337': 'FL', '338': 'FL', '339': 'FL',
  '340': 'FL', '341': 'FL', '342': 'FL', '344': 'FL', '346': 'FL',
  '347': 'FL', '349': 'FL',
};

function getStateFromZip(zipCode: string): string | null {
  if (!zipCode || zipCode.length !== 5) {
    return null;
  }
  const prefix3 = zipCode.substring(0, 3);
  return ZIP_PREFIX_TO_STATE[prefix3] || null;
}

async function fixGreggZipStates() {
  console.log('Fixing state values for Gregg Blanchard ZIPs...\n');

  // Get all Gregg Blanchard ZIPs with null state
  const { data: zips, error: fetchError } = await supabase
    .from('client_zipcodes')
    .select('id, zip, state, month')
    .eq('client_name', 'Gregg Blanchard')
    .is('state', null);

  if (fetchError) {
    console.error('Error fetching ZIPs:', fetchError);
    return;
  }

  console.log(`Found ${zips?.length || 0} ZIPs with null state for Gregg Blanchard`);

  if (!zips || zips.length === 0) {
    console.log('No ZIPs to fix!');
    return;
  }

  // Update each ZIP with the correct state
  let updated = 0;
  let failed = 0;

  for (const zip of zips) {
    const state = getStateFromZip(zip.zip);

    if (!state) {
      console.log(`Warning: Could not determine state for ZIP ${zip.zip}`);
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('client_zipcodes')
      .update({ state })
      .eq('id', zip.id);

    if (updateError) {
      console.error(`Error updating ZIP ${zip.zip}:`, updateError);
      failed++;
    } else {
      console.log(`✓ Updated ZIP ${zip.zip} to state ${state} (month: ${zip.month})`);
      updated++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  - Updated: ${updated}`);
  console.log(`  - Failed: ${failed}`);
  console.log(`  - Total: ${zips.length}`);

  // Verify the update
  const { count: nullCount } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('client_name', 'Gregg Blanchard')
    .is('state', null);

  console.log(`\nRemaining ZIPs with null state: ${nullCount || 0}`);
}

fixGreggZipStates();
