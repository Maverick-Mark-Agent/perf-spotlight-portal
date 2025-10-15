import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateNovemberToStaging() {
  console.log('🔄 Migrating November 2025 ZIPs to staging area (month=\'active\')...\n');

  try {
    // Step 1: Fetch all November 2025 ZIPs
    console.log('📥 Fetching all ZIPs from November 2025...');
    const { data: novemberZips, error: fetchError } = await supabase
      .from('client_zipcodes')
      .select('*')
      .eq('month', '2025-11')
      .order('workspace_name', { ascending: true })
      .order('zip', { ascending: true });

    if (fetchError) throw fetchError;

    if (!novemberZips || novemberZips.length === 0) {
      console.log('⚠️  No ZIPs found for November 2025. Nothing to migrate.');
      return;
    }

    console.log(`✅ Found ${novemberZips.length} ZIPs in November 2025\n`);

    // Step 2: Group by workspace to show summary
    const workspaceSummary = novemberZips.reduce((acc, zip) => {
      const workspace = zip.workspace_name || zip.client_name;
      if (!acc[workspace]) {
        acc[workspace] = {
          count: 0,
          color: zip.agency_color,
        };
      }
      acc[workspace].count++;
      return acc;
    }, {} as Record<string, { count: number; color: string }>);

    console.log('📊 Summary by Agency:');
    Object.entries(workspaceSummary).forEach(([workspace, { count, color }]) => {
      console.log(`   ${workspace}: ${count} ZIPs (color: ${color})`);
    });
    console.log('');

    // Step 3: Check if staging area already has ZIPs
    const { data: existingStaging, error: checkError } = await supabase
      .from('client_zipcodes')
      .select('zip, workspace_name')
      .eq('month', 'active');

    if (checkError) throw checkError;

    if (existingStaging && existingStaging.length > 0) {
      console.log(`⚠️  WARNING: Staging area already has ${existingStaging.length} ZIPs!`);
      console.log('   These will be replaced by November data.\n');
    }

    // Step 4: Delete existing staging ZIPs
    console.log('🗑️  Clearing staging area...');
    const { error: deleteError } = await supabase
      .from('client_zipcodes')
      .delete()
      .eq('month', 'active');

    if (deleteError) throw deleteError;
    console.log('✅ Staging area cleared\n');

    // Step 5: Prepare staging entries
    console.log('📝 Preparing staging entries...');
    const stagingEntries = novemberZips.map(zip => ({
      zip: zip.zip,
      month: 'active', // <-- This is the key change
      client_name: zip.client_name,
      workspace_name: zip.workspace_name,
      agency_color: zip.agency_color,
      state: zip.state,
      source: zip.source || 'migrated_from_november',
      pulled_at: new Date().toISOString(),
      inserted_at: new Date().toISOString(),
    }));

    // Step 6: Insert in batches
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < stagingEntries.length; i += batchSize) {
      const batch = stagingEntries.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('client_zipcodes')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, insertError);
        throw insertError;
      }

      inserted += batch.length;
      console.log(`   ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stagingEntries.length / batchSize)} (${inserted}/${stagingEntries.length} ZIPs)`);
    }

    console.log('\n✅ Migration complete!');
    console.log(`\n📊 Final Summary:`);
    console.log(`   - ${novemberZips.length} ZIPs migrated to staging area`);
    console.log(`   - ${Object.keys(workspaceSummary).length} agencies affected`);
    console.log(`   - November 2025 ZIPs remain unchanged (not deleted)`);
    console.log(`\n💡 Next Steps:`);
    console.log(`   1. Open ZIP Dashboard to see all ZIPs in staging`);
    console.log(`   2. Make any adjustments (add/remove ZIPs per agency)`);
    console.log(`   3. Commit to December 2025 or other months as needed`);

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateNovemberToStaging();
