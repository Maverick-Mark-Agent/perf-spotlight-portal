#!/usr/bin/env node

/**
 * Script to check burned email accounts from Supabase sender_emails_cache table
 * This is where the dashboard actually gets its data from!
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Company tags to look for
const COMPANY_TAGS = ['ScaledMail', 'CheapInboxes', 'Zapmail', 'Mailr'];
// Provider tags to look for
const PROVIDER_TAGS = ['Microsoft', 'Google', 'Outlook'];

/**
 * Fetch all sender emails from Supabase cache
 */
async function getAllSenderEmailsFromCache() {
  console.log('Fetching sender emails from Supabase sender_emails_cache table...\n');

  // Get count first
  const { count } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  console.log(`Total accounts in cache: ${count || 0}`);

  // Fetch all accounts with explicit limit
  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .limit(count || 50000);

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  console.log(`Fetched ${accounts?.length || 0} sender email accounts from Supabase\n`);

  return accounts || [];
}

/**
 * Parse the input CSV file
 */
function parseInputCSV(filePath) {
  console.log(`Reading CSV file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Extract email addresses from each line (5th column, index 4)
  const emails = [];
  for (const line of lines) {
    // Split by comma, handling quoted fields
    const fields = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    if (fields.length > 4) {
      let email = fields[4].replace(/^"|"$/g, '').trim();
      // Remove any trailing commas
      email = email.replace(/,+$/, '');
      if (email && email.includes('@')) {
        emails.push(email);
      }
    }
  }

  console.log(`Found ${emails.length} email addresses in CSV\n`);
  return emails;
}

/**
 * Main function
 */
async function main() {
  try {
    const inputFile = '/Users/mac/Downloads/inbox-placement-tests-b108d2f9-4a41-41e9-b140-33f96380194a - Sheet1.csv';
    const outputFile = '/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags.csv';

    // Parse input CSV
    const burnedEmails = parseInputCSV(inputFile);

    // Fetch all sender emails from Supabase cache
    const allSenderEmails = await getAllSenderEmailsFromCache();

    // Create a map for faster lookup (by email address)
    const emailMap = new Map();
    allSenderEmails.forEach(account => {
      const email = account.email_address?.toLowerCase();
      if (email) {
        // Store all instances of this email (could be in multiple workspaces)
        if (!emailMap.has(email)) {
          emailMap.set(email, []);
        }
        emailMap.get(email).push(account);
      }
    });

    // Process each burned email
    console.log('Processing burned email accounts...\n');
    const results = [];
    let foundCount = 0;
    let notFoundCount = 0;

    for (const email of burnedEmails) {
      const emailLower = email.toLowerCase().trim();
      const accountInstances = emailMap.get(emailLower);

      if (accountInstances && accountInstances.length > 0) {
        // Use the first instance (they should all have the same tags)
        const account = accountInstances[0];
        const tags = account.tags || [];

        // Find company tag
        const companyTag = tags.find(tag =>
          COMPANY_TAGS.some(ct => tag.toLowerCase() === ct.toLowerCase())
        ) || 'N/A';

        // Find provider tag
        const providerTag = tags.find(tag =>
          PROVIDER_TAGS.some(pt => tag.toLowerCase() === pt.toLowerCase())
        ) || 'N/A';

        results.push({
          email,
          companyTag,
          providerTag,
          workspace: account.workspace_name || 'N/A',
          status: account.status || 'N/A',
          allTags: tags.join('; ')
        });

        foundCount++;
        console.log(`✓ ${email}`);
        console.log(`  Company: ${companyTag}, Provider: ${providerTag}`);
        console.log(`  Workspace: ${account.workspace_name}, Status: ${account.status}`);
        console.log(`  All tags: ${tags.join(', ') || 'None'}\n`);
      } else {
        results.push({
          email,
          companyTag: 'NOT_FOUND',
          providerTag: 'NOT_FOUND',
          workspace: 'NOT_FOUND',
          status: 'NOT_FOUND',
          allTags: 'Email not found in Supabase cache'
        });
        notFoundCount++;
        console.log(`✗ ${email}: NOT FOUND\n`);
      }
    }

    // Generate output CSV
    console.log('Generating output CSV...');
    const csvLines = ['Email,Company Tag,Provider Tag,Workspace,Status,All Tags'];

    for (const result of results) {
      const line = `"${result.email}","${result.companyTag}","${result.providerTag}","${result.workspace}","${result.status}","${result.allTags}"`;
      csvLines.push(line);
    }

    fs.writeFileSync(outputFile, csvLines.join('\n'));

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total burned emails: ${burnedEmails.length}`);
    console.log(`Found in Supabase cache: ${foundCount}`);
    console.log(`Not found: ${notFoundCount}`);
    console.log(`Output file: ${outputFile}`);
    console.log('='.repeat(80));

    // Show tag statistics
    console.log('\nTAG STATISTICS:');
    const companyTagCounts = {};
    const providerTagCounts = {};

    results.forEach(r => {
      if (r.companyTag !== 'NOT_FOUND' && r.companyTag !== 'N/A') {
        companyTagCounts[r.companyTag] = (companyTagCounts[r.companyTag] || 0) + 1;
      }
      if (r.providerTag !== 'NOT_FOUND' && r.providerTag !== 'N/A') {
        providerTagCounts[r.providerTag] = (providerTagCounts[r.providerTag] || 0) + 1;
      }
    });

    console.log('\nCompany Tags:');
    if (Object.keys(companyTagCounts).length === 0) {
      console.log('  (none found)');
    } else {
      Object.entries(companyTagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
        console.log(`  ${tag}: ${count}`);
      });
    }

    console.log('\nProvider Tags:');
    if (Object.keys(providerTagCounts).length === 0) {
      console.log('  (none found)');
    } else {
      Object.entries(providerTagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
        console.log(`  ${tag}: ${count}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();