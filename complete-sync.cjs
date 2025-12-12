const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function completeSync() {
  console.log('Completing Email Bison sync for all workspaces...\n');

  let batchOffset = 8; // Start from batch 2 (batch 1 already done)
  const batchSize = 8;
  let batchNumber = 2;
  let totalAccountsSynced = 4130; // From batch 1

  while (true) {
    console.log(`\n=== Batch ${batchNumber} (offset: ${batchOffset}) ===`);

    try {
      const { data, error } = await supabase.functions.invoke('poll-sender-emails', {
        body: {
          force: true,
          batch_offset: batchOffset,
          batch_size: batchSize
        }
      });

      if (error) {
        console.error(`❌ Error on batch ${batchNumber}:`, error);
        break;
      }

      if (data.success) {
        console.log(`✅ Batch ${batchNumber} completed:`);
        console.log(`  Workspaces processed: ${data.workspaces_processed}`);
        console.log(`  Accounts synced: ${data.total_accounts_synced}`);
        console.log(`  Duration: ${(data.duration_ms / 1000).toFixed(1)}s`);

        totalAccountsSynced += data.total_accounts_synced;

        if (!data.has_more_batches) {
          console.log('\n🎉 All batches completed!');
          console.log(`Total accounts synced: ${totalAccountsSynced}`);
          break;
        }

        batchOffset = data.next_batch_offset;
        batchNumber++;
      } else {
        console.error(`❌ Batch ${batchNumber} failed:`, data.message);
        break;
      }

    } catch (err) {
      console.error(`❌ Exception on batch ${batchNumber}:`, err.message);
      break;
    }

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== SYNC COMPLETE ===');
  console.log('You can now refresh your dashboard to see fresh data!');
  console.log('Total accounts synced across all batches:', totalAccountsSynced);
}

completeSync();
