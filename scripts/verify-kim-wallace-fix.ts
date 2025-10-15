import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFix() {
  console.log('Verifying Kim Wallace Contact Pipeline data:\n');

  // Check zip_batch_pulls summary
  const { data: summary } = await supabase
    .from('zip_batch_pulls')
    .select('batch_number, pulled_at, raw_contacts_uploaded')
    .eq('workspace_name', 'Kim Wallace')
    .eq('month', '2025-11');

  const totalBatches = new Set(summary?.map(s => s.batch_number)).size;
  const pulledBatches = new Set(summary?.filter(s => s.pulled_at).map(s => s.batch_number)).size;
  const totalContacts = summary?.reduce((sum, s) => sum + (s.raw_contacts_uploaded || 0), 0) || 0;

  console.log(`Total ZIPs: ${summary?.length}`);
  console.log(`Total Batches: ${totalBatches}`);
  console.log(`Pulled Batches: ${pulledBatches}`);
  console.log(`Unpulled Batches: ${totalBatches - pulledBatches}`);
  console.log(`Raw Contacts Uploaded: ${totalContacts}`);

  console.log('\nBatch breakdown (first 5):');
  const batchMap = new Map<number, { count: number; pulled: number }>();
  summary?.forEach(s => {
    if (!batchMap.has(s.batch_number)) {
      batchMap.set(s.batch_number, { count: 0, pulled: 0 });
    }
    const batch = batchMap.get(s.batch_number)!;
    batch.count++;
    if (s.pulled_at) batch.pulled++;
  });

  Array.from(batchMap.entries()).sort((a, b) => a[0] - b[0]).slice(0, 5).forEach(([num, data]) => {
    console.log(`  Batch ${num}: ${data.count} ZIPs (${data.pulled} pulled)`);
  });
}

verifyFix().catch(console.error);
