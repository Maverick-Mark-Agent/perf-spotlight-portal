import fs from 'fs';
import path from 'path';
import os from 'os';

async function downloadCsv() {
  console.log('📥 Downloading Kim Wallace CSV for manual upload...\n');

  const csvUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/storage/v1/object/public/contact-csvs/Kim%20Wallace/2025-11/raw_contacts.csv';

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const csvBuffer = Buffer.from(arrayBuffer);

  // Save to Downloads folder
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'kim_wallace_november_2025.csv');
  fs.writeFileSync(downloadsPath, csvBuffer);

  console.log(`✅ Downloaded ${(csvBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);
  console.log(`💾 Saved to: ${downloadsPath}\n`);
  console.log('📋 Next steps:');
  console.log('   1. Open your dashboard at http://localhost:5173');
  console.log('   2. Go to Contact Pipeline Dashboard');
  console.log('   3. Click "Upload CSV"');
  console.log('   4. Select client: Kim Wallace');
  console.log('   5. Select month: 2025-11');
  console.log('   6. Choose file: kim_wallace_november_2025.csv');
  console.log('   7. Click Upload\n');
  console.log('✨ The flexible CSV parser will:');
  console.log('   - Accept all 23 columns');
  console.log('   - Route 106 HNW contacts (TX + ≥$900k) to Kirk Hodgson');
  console.log('   - Route 4,458 standard contacts to Kim Wallace');
  console.log('   - Store extra fields (Phone, DNC, Race, etc.) in JSONB\n');
}

downloadCsv().catch(console.error);
