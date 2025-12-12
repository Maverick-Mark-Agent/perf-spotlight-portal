#!/usr/bin/env node

/**
 * Debug the latest CSV to understand the gap
 */

const fs = require('fs');

const inputFile = '/Users/mac/Downloads/Burnt Accounts - Sheet1.csv';

const THIRD_PARTY_FILTERS = [
  'opensend', 'infonycs', 'visionair', 'fllending', 'trysalessociety',
  'securifyprotection', 'findymail', 'coachpronext', 'withwemdev', 'infopstg',
  'getlessstress', 'gigabrain', 'ssrecruiting', 'homepolicyinsurance', 'streetsmart'
];

/**
 * Properly parse CSV with quoted fields
 */
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
  const fields = parseCSVLine(line);

  // Sender email is in column 5 (index 4)
  if (fields.length > 4 && fields[4].trim()) {
    const senderEmailField = fields[4].trim();

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
  console.log('THIRD-PARTY EMAILS FILTERED (sample of first 30)');
  console.log('='.repeat(80));
  Array.from(thirdPartyEmails).slice(0, 30).forEach(email => {
    console.log(`  ${email}`);
  });
  if (thirdPartyEmails.size > 30) {
    console.log(`  ... and ${thirdPartyEmails.size - 30} more`);
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
console.log(`User expects: 855 burned accounts`);
console.log(`CSV has: ${lines.length - 1} data rows`);
console.log(`Script found: ${uniqueEmails.size} unique client emails`);
console.log(`Difference: ${lines.length - 1 - uniqueEmails.size} rows`);

console.log('\nAccounting for the difference:');
console.log(`  Third-party emails filtered: ${thirdPartyFiltered}`);
console.log(`  Duplicate emails: ${totalEmailsExtracted - thirdPartyFiltered - uniqueEmails.size}`);
console.log(`  Empty rows: ${rowsWithoutEmails}`);
console.log(`  Total accounted for: ${thirdPartyFiltered + (totalEmailsExtracted - thirdPartyFiltered - uniqueEmails.size) + rowsWithoutEmails}`);