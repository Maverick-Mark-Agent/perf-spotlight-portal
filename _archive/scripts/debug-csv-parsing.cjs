#!/usr/bin/env node

/**
 * Debug CSV parsing to understand the gap between 472 rows and 388 unique emails
 */

const fs = require('fs');

const inputFile = '/Users/mac/Downloads/Burnt Accounts - inbox-placement-tests-b108d2f9-4a41-41e9-b140-33f96380194a.csv (1).csv';

const THIRD_PARTY_FILTERS = [
  'opensend', 'infonycs', 'visionair', 'fllending', 'trysalessociety',
  'securifyprotection', 'findymail', 'coachpronext', 'withwemdev', 'infopstg',
  'getlessstress', 'gigabrain', 'ssrecruiting'
];

console.log('='.repeat(80));
console.log('CSV PARSING DIAGNOSTIC');
console.log('='.repeat(80));

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

console.log(`\nTotal lines in CSV: ${lines.length}`);
console.log(`Data rows (excluding header): ${lines.length - 1}`);

// Track statistics
let rowsWithEmails = 0;
let rowsWithoutEmails = 0;
let totalEmailsExtracted = 0;
let thirdPartyFiltered = 0;
const uniqueEmails = new Set();
const duplicateEmails = new Map();
const thirdPartyEmails = new Set();

// Skip header
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const fields = line.split(',');

  // Sender email is in column 5 (index 4)
  if (fields.length > 4) {
    const senderEmailField = fields[4];

    // Extract all email addresses from the field
    const emailMatches = senderEmailField.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

    if (emailMatches && emailMatches.length > 0) {
      rowsWithEmails++;

      emailMatches.forEach(email => {
        const cleanEmail = email.trim().toLowerCase();
        totalEmailsExtracted++;

        // Check if it's a third-party email
        const isThirdParty = THIRD_PARTY_FILTERS.some(filter => cleanEmail.includes(filter));

        if (isThirdParty) {
          thirdPartyFiltered++;
          thirdPartyEmails.add(cleanEmail);
        } else {
          if (uniqueEmails.has(cleanEmail)) {
            // Track duplicates
            duplicateEmails.set(cleanEmail, (duplicateEmails.get(cleanEmail) || 1) + 1);
          }
          uniqueEmails.add(cleanEmail);
        }
      });
    } else {
      rowsWithoutEmails++;
    }
  } else {
    rowsWithoutEmails++;
  }
}

console.log('\n' + '='.repeat(80));
console.log('PARSING STATISTICS');
console.log('='.repeat(80));
console.log(`Rows with valid emails: ${rowsWithEmails}`);
console.log(`Rows without emails: ${rowsWithoutEmails}`);
console.log(`Total emails extracted: ${totalEmailsExtracted}`);
console.log(`Third-party emails filtered: ${thirdPartyFiltered}`);
console.log(`Duplicate emails removed: ${totalEmailsExtracted - thirdPartyFiltered - uniqueEmails.size}`);
console.log(`Final unique emails: ${uniqueEmails.size}`);

console.log('\n' + '='.repeat(80));
console.log('BREAKDOWN');
console.log('='.repeat(80));
console.log(`${lines.length - 1} rows in CSV`);
console.log(`  - ${rowsWithoutEmails} rows with no valid email (empty/invalid)`);
console.log(`  - ${rowsWithEmails} rows with valid emails`);
console.log(`    → ${totalEmailsExtracted} total emails extracted`);
console.log(`      - ${thirdPartyFiltered} third-party emails filtered out`);
console.log(`      - ${totalEmailsExtracted - thirdPartyFiltered - uniqueEmails.size} duplicate emails`);
console.log(`      = ${uniqueEmails.size} unique client emails`);

if (thirdPartyEmails.size > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('THIRD-PARTY EMAILS FILTERED (sample of first 20)');
  console.log('='.repeat(80));
  Array.from(thirdPartyEmails).slice(0, 20).forEach(email => {
    console.log(`  ${email}`);
  });
  if (thirdPartyEmails.size > 20) {
    console.log(`  ... and ${thirdPartyEmails.size - 20} more`);
  }
}

if (duplicateEmails.size > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('TOP 20 DUPLICATE EMAILS');
  console.log('='.repeat(80));
  const sorted = Array.from(duplicateEmails.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  sorted.forEach(([email, count]) => {
    console.log(`  ${email} (appears ${count + 1} times)`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('EXPECTED vs ACTUAL');
console.log('='.repeat(80));
console.log(`User expects: 472 burned accounts`);
console.log(`CSV has: ${lines.length - 1} data rows`);
console.log(`Script found: ${uniqueEmails.size} unique client emails`);
console.log(`Difference: ${lines.length - 1 - uniqueEmails.size} rows`);

console.log('\nPossible explanations:');
console.log('1. CSV contains third-party emails that should be excluded');
console.log('2. Some rows have multiple email addresses (extracted all)');
console.log('3. Duplicate emails across different rows');
console.log('4. Empty or invalid email fields in some rows');
