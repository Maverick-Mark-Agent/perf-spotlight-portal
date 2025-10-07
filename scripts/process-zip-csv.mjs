import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

// Name mapping: CSV Territory → Email Bison workspace_name
const NAME_MAPPING = {
  'Nick Sakah': 'Nick Sakha',  // Fix spelling mismatch
  'Danny Schwartz': 'Danny Schwartz',
  'David Amiri': 'David Amiri',
  'Devin Hodo': 'Devin Hodo',
  'Jason Binyon': 'Jason Binyon',
  'John Roberts': 'John Roberts',
  'Kim Wallace': 'Kim Wallace',
  'Rob Russell': 'Rob Russell',
  'Tony Schmitz': 'Tony Schmitz',
};

// Color mapping: CSS color name → hex code
const COLOR_MAPPING = {
  'Green': '#10B981',
  'green': '#10B981',
  'Blue': '#3B82F6',
  'blue': '#3B82F6',
  'orange': '#F97316',
  'Orange': '#F97316',
  'Red': '#EF4444',
  'red': '#EF4444',
  'yellow': '#EAB308',
  'Yellow': '#EAB308',
  'Purple': '#A855F7',
  'purple': '#8B5CF6',  // Different shade for Tony Schmitz
  'black': '#000000',
  'Black': '#000000',
  'Magenta': '#EC4899',
  'magenta': '#EC4899',
  '': '#9CA3AF',  // Gray for empty/unassigned
};

const csvPath = process.argv[2];
const outputPath = process.argv[3];

if (!csvPath || !outputPath) {
  console.error('Usage: node scripts/process-zip-csv.mjs "<input.csv>" "<output.csv>"');
  process.exit(1);
}

// Load Supabase to verify workspace names
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyWorkspaceNames() {
  const { data, error } = await supabase
    .from('client_registry')
    .select('workspace_name')
    .order('workspace_name');

  if (error) {
    console.error('Error fetching workspace names:', error);
    return new Set();
  }

  return new Set(data.map(r => r.workspace_name));
}

async function processCSV() {
  console.log('\n🔄 Processing ZIP Code Master List...\n');

  // Verify workspace names exist in database
  const validWorkspaces = await verifyWorkspaceNames();
  console.log(`✅ Found ${validWorkspaces.size} workspace names in database\n`);

  // Read CSV
  const csvContent = await fs.readFile(csvPath, 'utf-8');
  const lines = csvContent.split(/\r?\n/);
  const headers = lines[0].split(',');

  console.log(`📄 Input CSV: ${csvPath}`);
  console.log(`📊 Total rows: ${lines.length - 1}\n`);

  // Process rows with deduplication (keep first occurrence)
  const outputLines = ['Zipcode,Territory,Color'];  // New header
  let processedCount = 0;
  let unmappedNames = new Set();
  let unmappedColors = new Set();
  const seenZips = new Set();  // Track ZIP codes we've already processed
  let duplicateCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [zipcode, territory, color] = line.split(',');

    // Skip duplicate ZIPs (keep first occurrence)
    if (seenZips.has(zipcode)) {
      duplicateCount++;
      continue;
    }
    seenZips.add(zipcode);

    // Map territory name
    const mappedName = NAME_MAPPING[territory?.trim()] || territory?.trim();

    // Map color
    const mappedColor = COLOR_MAPPING[color?.trim()] || color?.trim();

    // Track unmapped values
    if (territory && !NAME_MAPPING[territory.trim()] && territory.trim() !== mappedName) {
      unmappedNames.add(territory.trim());
    }
    if (color && !COLOR_MAPPING[color.trim()]) {
      unmappedColors.add(color.trim());
    }

    // Verify workspace exists
    if (mappedName && !validWorkspaces.has(mappedName)) {
      console.warn(`⚠️  Warning: "${mappedName}" not found in client_registry`);
    }

    outputLines.push(`${zipcode},${mappedName},${mappedColor}`);
    processedCount++;
  }

  if (duplicateCount > 0) {
    console.log(`⚠️  Removed ${duplicateCount} duplicate ZIPs (kept first occurrence)\n`);
  }

  // Write output CSV
  await fs.writeFile(outputPath, outputLines.join('\n'));

  console.log('✅ Processing complete!\n');
  console.log(`📤 Output CSV: ${outputPath}`);
  console.log(`📊 Processed rows: ${processedCount}\n`);

  // Report unmapped values
  if (unmappedNames.size > 0) {
    console.log('⚠️  Unmapped territory names:');
    unmappedNames.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }

  if (unmappedColors.size > 0) {
    console.log('⚠️  Unmapped colors:');
    unmappedColors.forEach(color => console.log(`   - ${color}`));
    console.log('');
  }

  // Show mapping summary
  console.log('📋 Name Mappings Applied:');
  const uniqueTerritories = new Set();
  for (let i = 1; i < lines.length; i++) {
    const territory = lines[i].split(',')[1]?.trim();
    if (territory) uniqueTerritories.add(territory);
  }

  uniqueTerritories.forEach(territory => {
    const mapped = NAME_MAPPING[territory] || territory;
    const icon = NAME_MAPPING[territory] ? '→' : '✓';
    console.log(`   ${icon} ${territory}${NAME_MAPPING[territory] ? ` → ${mapped}` : ''}`);
  });

  console.log('\n✅ Ready to import! Run:');
  console.log(`   node scripts/import-zip-codes.mjs "${outputPath}" "2025-11" --client-col "Territory" --zip-col "Zipcode" --color-col "Color"\n`);
}

processCSV().catch(console.error);
