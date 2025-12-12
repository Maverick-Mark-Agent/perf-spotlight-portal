#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

async function main() {
  console.log('Creating Supabase client...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('Fetching ALL email accounts from sender_emails_cache...\n');

  // Fetch ALL accounts
  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('*');

  if (error) {
    console.error('Supabase error:', error);
    process.exit(1);
  }

  console.log(`Fetched ${accounts.length} accounts from Supabase\n`);

  // Create map of accounts by email
  const emailMap = new Map();
  accounts.forEach(account => {
    const email = account.email_address?.toLowerCase();
    if (email) {
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email).push(account);
    }
  });

  // Read Sheet12 CSV
  const csvPath = '/Users/mac/Downloads/Burnt Accounts - Sheet12.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');

  console.log(`Processing ${lines.length - 1} accounts from Sheet12...\n`);

  const notFound = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);
    const email = fields[0]?.trim().toLowerCase();
    const workspace = fields[1]?.trim();

    if (!email) continue;

    // Look up in Email Bison
    const accountInstances = emailMap.get(email);

    if (!accountInstances || accountInstances.length === 0) {
      notFound.push({ email, workspace, line: i + 1 });
    }
  }

  console.log(`\n📋 NOT FOUND ACCOUNTS: ${notFound.length}\n`);

  if (notFound.length > 0) {
    console.log('These emails are in Sheet12 but NOT found in Email Bison:\n');
    notFound.forEach(({ email, workspace, line }) => {
      console.log(`Line ${line}: ${email} (${workspace})`);
    });

    // Now check if these were recently deleted
    console.log('\n\nChecking if these accounts were recently deleted...');
    console.log('(Note: We deleted 51 Zapmail accounts earlier)\n');

    // Check which ones were in the deleted Zapmail list
    const deletedZapmailPath = '/Users/mac/Downloads/Burnt Accounts - Zapmail.csv';
    if (fs.existsSync(deletedZapmailPath)) {
      const zapmailContent = fs.readFileSync(deletedZapmailPath, 'utf-8');
      const zapmailLines = zapmailContent.trim().split('\n').slice(1);
      const deletedEmails = new Set();

      zapmailLines.forEach(line => {
        const fields = line.split(',');
        const email = fields[0]?.trim().toLowerCase();
        if (email) deletedEmails.add(email);
      });

      const deletedRecently = notFound.filter(({ email }) => deletedEmails.has(email));

      if (deletedRecently.length > 0) {
        console.log(`✓ ${deletedRecently.length} accounts were recently deleted (Zapmail batch):`);
        deletedRecently.forEach(({ email, workspace }) => {
          console.log(`  - ${email} (${workspace})`);
        });
      }

      const stillMissing = notFound.filter(({ email }) => !deletedEmails.has(email));
      if (stillMissing.length > 0) {
        console.log(`\n⚠️  ${stillMissing.length} accounts are missing for OTHER reasons:`);
        stillMissing.forEach(({ email, workspace }) => {
          console.log(`  - ${email} (${workspace})`);
        });
      }
    }
  } else {
    console.log('✓ All accounts found!');
  }
}

main().catch(console.error);