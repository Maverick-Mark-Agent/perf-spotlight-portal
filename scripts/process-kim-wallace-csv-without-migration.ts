import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const HNW_THRESHOLD = 900000;
const KIRK_WORKSPACE = 'Kirk Hodgson';

interface CsvRow {
  'First Name': string;
  'Last Name': string;
  'Address 1': string;
  'Address 2': string;
  'City': string;
  'ST': string;
  'ZIP': string;
  'Phone': string;
  'DNC': string;
  'Purchase Date': string;
  'Purchase Amount': string;
  'Cell Phone': string;
  'DNC Cell': string;
  'Email Address': string;
  'Est. Home Value': string;
  'Race': string;
  'Home Value': string;
  'Investments': string;
  'Investment Type': string;
  'Date of Birth': string;
  'Head Household': string;
  'Net Worth': string;
  'Income': string;
}

function parseHomeValue(value: string): number {
  if (!value) return 0;
  const cleaned = value.toString().replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function findBestHomeValue(row: CsvRow): number {
  // Try multiple columns for home value
  const estHomeValue = parseHomeValue(row['Est. Home Value']);
  const homeValue = parseHomeValue(row['Home Value']);
  const purchaseAmount = parseHomeValue(row['Purchase Amount']);

  // Return the highest non-zero value
  return Math.max(estHomeValue, homeValue, purchaseAmount);
}

function isHeadOfHousehold(firstName: string | null): boolean {
  if (!firstName) return false;
  const normalized = firstName.trim().toLowerCase();

  // Filter out if multiple names (e.g., "John & Jane", "John and Jane")
  if (normalized.includes('&') || normalized.includes(' and ') || normalized.includes(' or ')) {
    return false;
  }

  return true;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

async function processKimWallaceCsv() {
  console.log('📥 Processing Kim Wallace CSV from storage...\n');

  const csvUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co/storage/v1/object/public/contact-csvs/Kim%20Wallace/2025-11/raw_contacts.csv';

  console.log(`📄 Fetching CSV from: ${csvUrl}\n`);

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.statusText}`);
  }

  const csvText = await response.text();
  console.log(`✅ Downloaded CSV (${(csvText.length / 1024 / 1024).toFixed(2)} MB)\n`);

  // Parse CSV with lenient options to handle malformed quotes
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_records_with_error: true
  }) as CsvRow[];

  console.log(`📊 Found ${rows.length.toLocaleString()} contacts\n`);

  const uploadBatchId = randomUUID();
  console.log(`📦 Batch ID: ${uploadBatchId}\n`);

  const kimContacts: any[] = [];
  const kirkContacts: any[] = [];

  let hnwCount = 0;
  let standardCount = 0;
  let filteredCount = 0;

  const filterReasons: Record<string, number> = {};

  for (const row of rows) {
    const firstName = row['First Name']?.trim() || null;
    const lastName = row['Last Name']?.trim() || null;
    const email = row['Email Address']?.trim() || null;
    const state = row['ST']?.trim() || null;
    const zip = row['ZIP']?.trim() || null;
    const city = row['City']?.trim() || null;
    const address1 = row['Address 1']?.trim() || null;
    const address2 = row['Address 2']?.trim() || null;

    const homeValue = findBestHomeValue(row);
    const purchaseDate = parseDate(row['Purchase Date']);

    const isHoH = isHeadOfHousehold(firstName);
    const isTexas = state === 'TX';
    const isHNW = isTexas && homeValue >= HNW_THRESHOLD;

    // Apply filters
    let filterReason: string | null = null;

    if (!isHoH) {
      filterReason = 'Not head of household';
      filteredCount++;
      filterReasons[filterReason] = (filterReasons[filterReason] || 0) + 1;
      continue;
    }

    if (!email || !email.match(/^[^@]+@[^@]+\.[^@]+$/)) {
      filterReason = 'Missing or invalid email';
      filteredCount++;
      filterReasons[filterReason] = (filterReasons[filterReason] || 0) + 1;
      continue;
    }

    // Build contact object (WITHOUT extra_fields and csv_column_mapping)
    const contact = {
      upload_batch_id: uploadBatchId,
      client_name: isHNW ? 'Kirk Hodgson' : 'Kim Wallace',
      workspace_name: isHNW ? KIRK_WORKSPACE : 'Kim Wallace',
      month: '2025-11',
      uploaded_by: 'retroactive_script',
      first_name: firstName,
      last_name: lastName,
      email: email,
      property_address: address1 ? (address2 ? `${address1}, ${address2}` : address1) : null,
      property_city: city,
      property_state: state,
      property_zip: zip,
      mailing_address: null,
      mailing_city: null,
      mailing_state: null,
      mailing_zip: null,
      home_value_estimate: homeValue,
      purchase_date: purchaseDate,
      is_head_of_household: isHoH,
      meets_value_criteria: isHNW,
      is_high_net_worth: isHNW,
      parsed_purchase_date: purchaseDate,
      processing_status: 'ready_for_verification',
      filter_reason: null
    };

    if (isHNW) {
      kirkContacts.push(contact);
      hnwCount++;
    } else {
      kimContacts.push(contact);
      standardCount++;
    }
  }

  console.log('\n📈 Processing Summary:');
  console.log(`   Total rows: ${rows.length.toLocaleString()}`);
  console.log(`   Filtered out: ${filteredCount.toLocaleString()}`);
  console.log(`   Ready to insert: ${(kimContacts.length + kirkContacts.length).toLocaleString()}`);
  console.log(`     → Kim Wallace: ${kimContacts.length.toLocaleString()}`);
  console.log(`     → Kirk Hodgson (HNW): ${kirkContacts.length.toLocaleString()}\n`);

  if (Object.keys(filterReasons).length > 0) {
    console.log('🚫 Filter reasons:');
    Object.entries(filterReasons).forEach(([reason, count]) => {
      console.log(`   - ${reason}: ${count.toLocaleString()}`);
    });
    console.log();
  }

  // Insert in batches (Supabase has a limit on batch size)
  const BATCH_SIZE = 1000;

  if (kimContacts.length > 0) {
    console.log(`💾 Inserting ${kimContacts.length.toLocaleString()} contacts for Kim Wallace...`);
    for (let i = 0; i < kimContacts.length; i += BATCH_SIZE) {
      const batch = kimContacts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('raw_contacts').insert(batch);
      if (error) {
        console.error(`❌ Error inserting Kim Wallace batch ${i / BATCH_SIZE + 1}:`, error);
        throw error;
      }
      console.log(`   ✅ Batch ${i / BATCH_SIZE + 1}/${Math.ceil(kimContacts.length / BATCH_SIZE)} inserted`);
    }
  }

  if (kirkContacts.length > 0) {
    console.log(`\n💾 Inserting ${kirkContacts.length.toLocaleString()} HNW contacts for Kirk Hodgson...`);
    for (let i = 0; i < kirkContacts.length; i += BATCH_SIZE) {
      const batch = kirkContacts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('raw_contacts').insert(batch);
      if (error) {
        console.error(`❌ Error inserting Kirk Hodgson batch ${i / BATCH_SIZE + 1}:`, error);
        throw error;
      }
      console.log(`   ✅ Batch ${i / BATCH_SIZE + 1}/${Math.ceil(kirkContacts.length / BATCH_SIZE)} inserted`);
    }
  }

  console.log('\n✅ All contacts processed successfully!\n');
  console.log('📊 Final Summary:');
  console.log(`   Kim Wallace: ${kimContacts.length.toLocaleString()} contacts`);
  console.log(`   Kirk Hodgson: ${kirkContacts.length.toLocaleString()} HNW contacts (TX + ≥$900k)`);
  console.log(`   Total inserted: ${(kimContacts.length + kirkContacts.length).toLocaleString()} contacts\n`);
}

processKimWallaceCsv().catch(console.error);
