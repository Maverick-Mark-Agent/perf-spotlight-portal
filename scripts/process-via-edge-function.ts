import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

async function processViaEdgeFunction() {
  console.log('📥 Downloading CSV from storage...\n');

  const csvUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/storage/v1/object/public/contact-csvs/Kim%20Wallace/2025-11/raw_contacts.csv';

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const csvBuffer = Buffer.from(arrayBuffer);
  console.log(`✅ Downloaded CSV (${(csvBuffer.length / 1024 / 1024).toFixed(2)} MB)\n`);

  // Save temporarily
  const tempCsvPath = path.join(__dirname, 'temp_kim_wallace.csv');
  fs.writeFileSync(tempCsvPath, csvBuffer);
  console.log(`💾 Saved to: ${tempCsvPath}\n`);

  // Create FormData using native FormData
  const formDataLib = await import('form-data');
  const FormData = formDataLib.default;

  const formData = new FormData();
  formData.append('csv_file', fs.createReadStream(tempCsvPath), {
    filename: 'raw_contacts.csv',
    contentType: 'text/csv'
  });
  formData.append('workspace_name', 'Kim Wallace');
  formData.append('month', '2025-11');
  formData.append('uploaded_by', 'retroactive_script');

  console.log('🔄 Calling process-contact-upload Edge Function...\n');

  try {
    const edgeFunctionResponse = await fetch(`${supabaseUrl}/functions/v1/process-contact-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        ...formData.getHeaders()
      },
      body: formData as any
    });

    console.log(`📡 Response status: ${edgeFunctionResponse.status} ${edgeFunctionResponse.statusText}\n`);

    const responseText = await edgeFunctionResponse.text();
    console.log('📄 Response body:\n', responseText, '\n');

    if (!edgeFunctionResponse.ok) {
      throw new Error(`Edge Function failed with status ${edgeFunctionResponse.status}: ${responseText}`);
    }

    const result = JSON.parse(responseText);

    console.log('✅ Processing complete!\n');
    console.log('📊 Summary:');
    console.log(JSON.stringify(result, null, 2));

    // Clean up temp file
    fs.unlinkSync(tempCsvPath);
    console.log('\n🗑️  Cleaned up temp file');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    // Clean up temp file on error too
    if (fs.existsSync(tempCsvPath)) {
      fs.unlinkSync(tempCsvPath);
    }
    throw error;
  }
}

processViaEdgeFunction().catch(console.error);
