#!/usr/bin/env node

/**
 * Process the new burned accounts CSV and match with Email Bison tags
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const COMPANY_TAGS = ['ScaledMail', 'CheapInboxes', 'Zapmail', 'Mailr'];
const PROVIDER_TAGS = ['Microsoft', 'Google', 'Outlook'];

/**
 * Parse the new CSV format
 */
function parseNewCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const emails = new Set();

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Split by comma, handling quoted fields
    const fields = line.split(',');

    // Sender email is in column 5 (index 4)
    if (fields.length > 4) {
      const senderEmailField = fields[4];

      // Extract all email addresses from the field (may contain multiple)
      const emailMatches = senderEmailField.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

      if (emailMatches) {
        emailMatches.forEach(email => {
          const cleanEmail = email.trim().toLowerCase();
          if (cleanEmail && !cleanEmail.includes('opensend') && !cleanEmail.includes('infonycs') &&
              !cleanEmail.includes('visionair') && !cleanEmail.includes('fllending') &&
              !cleanEmail.includes('trysalessociety') && !cleanEmail.includes('securifyprotection') &&
              !cleanEmail.includes('findymail') && !cleanEmail.includes('coachpronext') &&
              !cleanEmail.includes('withwemdev') && !cleanEmail.includes('infopstg') &&
              !cleanEmail.includes('getlessstress') && !cleanEmail.includes('gigabrain') &&
              !cleanEmail.includes('ssrecruiting')) {
            emails.add(cleanEmail);
          }
        });
      }
    }
  }

  return Array.from(emails).sort();
}

async function main() {
  console.log('Creating Supabase client...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('Fetching ALL email accounts from sender_emails_cache...\n');

  // Get total count first
  const { count: totalCount } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  console.log(`Found ${totalCount || 0} total accounts in cache`);

  // Fetch ALL accounts (same as dashboard)
  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .order('last_synced_at', { ascending: false })
    .limit(totalCount || 50000);

  if (error) {
    console.error('Supabase error:', error);
    process.exit(1);
  }

  console.log(`Fetched ${accounts.length} accounts from Supabase\n`);

  // Read burned emails CSV
  const inputFile = '/Users/mac/Downloads/Burnt Accounts - inbox-placement-tests-b108d2f9-4a41-41e9-b140-33f96380194a.csv (1).csv';
  const burnedEmails = parseNewCSV(inputFile);
  console.log(`Found ${burnedEmails.length} unique burned email addresses\n`);

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

  // Process burned emails
  console.log('Processing burned email accounts...\n');
  const results = [];
  let foundCount = 0;
  let notFoundCount = 0;

  for (const email of burnedEmails) {
    const emailLower = email.toLowerCase().trim();
    const accountInstances = emailMap.get(emailLower);

    if (accountInstances && accountInstances.length > 0) {
      const account = accountInstances[0];
      const tags = account.tags || [];

      // Extract tag names (tags are objects with {id, name, ...})
      const tagNames = tags.map(t => t.name || t);

      const companyTag = tagNames.find(tag =>
        COMPANY_TAGS.some(ct => tag.toLowerCase() === ct.toLowerCase())
      ) || 'N/A';

      const providerTag = tagNames.find(tag =>
        PROVIDER_TAGS.some(pt => tag.toLowerCase() === pt.toLowerCase())
      ) || 'N/A';

      const workspace = account.workspace_name || 'N/A';
      const status = account.status || 'N/A';

      results.push({
        email,
        companyTag,
        providerTag,
        workspace,
        status,
        allTags: tagNames.join('; ')
      });

      foundCount++;
      console.log(`✓ ${email}: Company=${companyTag}, Provider=${providerTag}, Workspace=${workspace}`);
    } else {
      results.push({
        email,
        companyTag: 'NOT_FOUND',
        providerTag: 'NOT_FOUND',
        workspace: 'NOT_FOUND',
        status: 'NOT_FOUND',
        allTags: 'Email not found'
      });
      notFoundCount++;
      console.log(`✗ ${email}: NOT FOUND`);
    }
  }

  // Generate CSV
  const outputFile = '/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags-new.csv';
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
  console.log(`Found: ${foundCount}`);
  console.log(`Not found: ${notFoundCount}`);
  console.log(`Output file: ${outputFile}`);
  console.log('='.repeat(80));

  // Statistics
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
}

main().catch(console.error);