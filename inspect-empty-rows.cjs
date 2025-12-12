#!/usr/bin/env node

/**
 * Inspect the 75 rows that don't have valid emails
 */

const fs = require('fs');

const inputFile = '/Users/mac/Downloads/Burnt Accounts - inbox-placement-tests-b108d2f9-4a41-41e9-b140-33f96380194a.csv (1).csv';

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

console.log('='.repeat(80));
console.log('ROWS WITHOUT VALID EMAIL ADDRESSES (Column 5)');
console.log('='.repeat(80));

let emptyCount = 0;

// Skip header
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const fields = line.split(',');

  // Check if column 5 (index 4) exists and has an email
  let hasValidEmail = false;

  if (fields.length > 4) {
    const senderEmailField = fields[4];
    const emailMatches = senderEmailField.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

    if (emailMatches && emailMatches.length > 0) {
      hasValidEmail = true;
    }
  }

  if (!hasValidEmail) {
    emptyCount++;
    if (emptyCount <= 30) {
      console.log(`\nRow ${i}:`);
      console.log(`  Full line: ${line.substring(0, 150)}${line.length > 150 ? '...' : ''}`);
      console.log(`  Column count: ${fields.length}`);
      if (fields.length > 4) {
        console.log(`  Column 5 content: "${fields[4]}"`);
      } else {
        console.log(`  Column 5: MISSING (row has only ${fields.length} columns)`);
      }
    }
  }
}

console.log(`\n${'='.repeat(80)}`);
console.log(`Total rows without valid email: ${emptyCount}`);
console.log(`(Showing first 30 above)`);
