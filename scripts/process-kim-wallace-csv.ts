import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function processKimWallaceCsv() {
  console.log('📥 Processing Kim Wallace CSV from storage...\n');

  const csvUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/storage/v1/object/public/contact-csvs/Kim%20Wallace/2025-11/raw_contacts.csv';

  console.log(`📄 Fetching CSV from: ${csvUrl}\n`);

  // Download the CSV
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.statusText}`);
  }

  const csvBlob = await response.blob();
  const csvFile = new File([csvBlob], 'raw_contacts.csv', { type: 'text/csv' });

  console.log(`✅ Downloaded CSV (${(csvBlob.size / 1024 / 1024).toFixed(2)} MB)\n`);

  // Call the Edge Function to process it
  const formData = new FormData();
  formData.append('csv_file', csvFile);
  formData.append('workspace_name', 'Kim Wallace');
  formData.append('month', '2025-11');
  formData.append('uploaded_by', 'retroactive_processing_script');

  console.log('🔄 Sending to process-contact-upload Edge Function...\n');

  const { data, error } = await supabase.functions.invoke('process-contact-upload', {
    body: formData,
  });

  if (error) {
    console.error('❌ Error processing CSV:', error);
    throw error;
  }

  console.log('\n✅ Processing complete!\n');
  console.log('📊 Summary:');
  console.log(JSON.stringify(data, null, 2));

  if (data?.summary) {
    console.log('\n📈 Results:');
    console.log(`   Total contacts: ${data.summary.total_contacts}`);
    console.log(`   Ready for verification: ${data.summary.ready_for_verification}`);
    console.log(`   Filtered out: ${data.summary.filtered_out}`);
    console.log(`   HNW contacts: ${data.summary.hnw_contacts}`);
    console.log(`   Routed to Kirk Hodgson: ${data.summary.kirk_routing_count}`);
    console.log(`   Columns detected: ${data.summary.columns_detected}`);

    if (data.summary.column_names) {
      console.log(`\n📋 CSV Columns detected:`);
      data.summary.column_names.forEach((col: string, i: number) => {
        console.log(`   ${i + 1}. ${col}`);
      });
    }

    if (data.summary.filter_reasons) {
      console.log(`\n🚫 Filter reasons:`);
      Object.entries(data.summary.filter_reasons).forEach(([reason, count]) => {
        console.log(`   - ${reason}: ${count}`);
      });
    }
  }

  console.log('\n' + data.message);
}

processKimWallaceCsv().catch(console.error);
