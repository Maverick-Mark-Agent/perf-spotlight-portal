import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixKimWallaceBatches() {
  const workspaceName = 'Kim Wallace';
  const month = '2025-11';

  console.log(`Fixing batch numbers for ${workspaceName} - ${month}...\n`);

  // Fetch all ZIPs in sorted order
  const { data: zips, error: fetchError } = await supabase
    .from('client_zipcodes')
    .select('zip, state')
    .eq('workspace_name', workspaceName)
    .eq('month', month)
    .order('zip', { ascending: true });

  if (fetchError) {
    console.error('Error fetching ZIPs:', fetchError);
    return;
  }

  if (!zips || zips.length === 0) {
    console.log('No ZIPs found');
    return;
  }

  console.log(`Found ${zips.length} ZIPs`);

  // Delete existing tracking
  console.log('Deleting existing zip_batch_pulls...');
  const { error: deleteError } = await supabase
    .from('zip_batch_pulls')
    .delete()
    .eq('workspace_name', workspaceName)
    .eq('month', month);

  if (deleteError) {
    console.error('Error deleting:', deleteError);
    return;
  }

  // Create new tracking with correct batch numbers (25 per batch)
  console.log('Creating new zip_batch_pulls with 25 ZIPs per batch...');
  const pullEntries = zips.map((zip, index) => ({
    workspace_name: workspaceName,
    month: month,
    zip: zip.zip,
    state: zip.state,
    batch_number: Math.floor(index / 25) + 1, // 25 ZIPs per batch
    pulled_at: null,
    raw_contacts_uploaded: 0,
  }));

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < pullEntries.length; i += batchSize) {
    const batch = pullEntries.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('zip_batch_pulls')
      .insert(batch);

    if (insertError) {
      console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, insertError);
      return;
    }
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pullEntries.length / batchSize)}`);
  }

  // Verify the fix
  const { data: batches } = await supabase
    .from('zip_batch_pulls')
    .select('batch_number')
    .eq('workspace_name', workspaceName)
    .eq('month', month);

  const batchCounts = new Map<number, number>();
  batches?.forEach(row => {
    const count = batchCounts.get(row.batch_number) || 0;
    batchCounts.set(row.batch_number, count + 1);
  });

  console.log('\n✅ Fixed! New batch distribution:');
  Array.from(batchCounts.entries()).sort((a, b) => a[0] - b[0]).forEach(([batch, count]) => {
    console.log(`  Batch ${batch}: ${count} ZIPs`);
  });

  console.log(`\nTotal batches: ${batchCounts.size}`);
  console.log(`Expected batches: ${Math.ceil(zips.length / 25)}`);
}

fixKimWallaceBatches().catch(console.error);
