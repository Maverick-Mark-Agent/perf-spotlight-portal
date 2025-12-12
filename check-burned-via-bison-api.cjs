#!/usr/bin/env node

const fs = require('fs');

const EMAIL_BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';
const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

// Company tags to look for
const COMPANY_TAGS = ['ScaledMail', 'CheapInboxes', 'Zapmail', 'Mailr'];
// Provider tags to look for
const PROVIDER_TAGS = ['Microsoft', 'Google', 'Outlook'];

/**
 * Parse input CSV
 */
function parseInputCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const emails = [];
  for (const line of lines) {
    const fields = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    if (fields.length > 4) {
      let email = fields[4].replace(/^"|"$/g, '').trim().replace(/,+$/, '');
      if (email && email.includes('@')) {
        emails.push(email);
      }
    }
  }

  return emails;
}

/**
 * Search for a specific email in Email Bison
 */
async function searchEmail(email) {
  const url = `${EMAIL_BISON_BASE_URL}/sender-emails?email=${encodeURIComponent(email)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${EMAIL_BISON_API_KEY}`,
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const accounts = data.data || data;

  // Find exact match
  return accounts.find(acc => acc.email.toLowerCase() === email.toLowerCase());
}

async function main() {
  const inputFile = '/Users/mac/Downloads/inbox-placement-tests-b108d2f9-4a41-41e9-b140-33f96380194a - Sheet1.csv';
  const outputFile = '/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags.csv';

  console.log('Reading burned emails CSV...');
  const burnedEmails = parseInputCSV(inputFile);
  console.log(`Found ${burnedEmails.length} burned emails\n`);

  console.log('Searching Email Bison for each account...\n');

  const results = [];
  let foundCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < burnedEmails.length; i++) {
    const email = burnedEmails[i];
    process.stdout.write(`[${i + 1}/${burnedEmails.length}] ${email}...`);

    const account = await searchEmail(email);

    if (account) {
      const tags = account.tags?.map(t => t.name) || [];

      const companyTag = tags.find(tag =>
        COMPANY_TAGS.some(ct => tag.toLowerCase() === ct.toLowerCase())
      ) || 'N/A';

      const providerTag = tags.find(tag =>
        PROVIDER_TAGS.some(pt => tag.toLowerCase() === pt.toLowerCase())
      ) || 'N/A';

      results.push({
        email,
        companyTag,
        providerTag,
        status: account.status || 'N/A',
        allTags: tags.join('; ')
      });

      foundCount++;
      console.log(` ✓ Found! Company=${companyTag}, Provider=${providerTag}`);
    } else {
      results.push({
        email,
        companyTag: 'NOT_FOUND',
        providerTag: 'NOT_FOUND',
        status: 'NOT_FOUND',
        allTags: 'Not found in Email Bison'
      });

      notFoundCount++;
      console.log(' ✗ Not found');
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Generate CSV
  console.log('\nGenerating output CSV...');
  const csvLines = ['Email,Company Tag,Provider Tag,Status,All Tags'];

  for (const result of results) {
    const line = `"${result.email}","${result.companyTag}","${result.providerTag}","${result.status}","${result.allTags}"`;
    csvLines.push(line);
  }

  fs.writeFileSync(outputFile, csvLines.join('\n'));

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total burned emails: ${burnedEmails.length}`);
  console.log(`Found in Email Bison: ${foundCount}`);
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