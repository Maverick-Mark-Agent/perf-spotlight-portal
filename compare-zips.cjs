const fs = require('fs');

// Read the existing 1300 ZIP codes list
const existingData = fs.readFileSync('Zip Code Master List - Texas Zips.csv', 'utf-8');
const existingLines = existingData.split('\n');
const existingZips = new Set();

// Extract ZIP codes from existing list (skip header, handle empty values)
for (let i = 1; i < existingLines.length; i++) {
  const line = existingLines[i].trim();
  if (line) {
    const zip = line.split(',')[0].trim();
    if (zip) {
      existingZips.add(zip);
    }
  }
}

console.log(`Existing list contains ${existingZips.size} unique ZIP codes`);

// Read the new 2500 ZIP codes list
const newData = fs.readFileSync('zip-codes-database-FREE - Sheet1.csv', 'utf-8');
const newLines = newData.split('\n');

// Find missing ZIP codes and store full records
const missingZips = [];
const header = newLines[0]; // Keep the header from the new file

for (let i = 1; i < newLines.length; i++) {
  const line = newLines[i].trim();
  if (line) {
    const fields = line.split(',');
    const zip = fields[0].trim();

    if (zip && !existingZips.has(zip)) {
      missingZips.push(line);
    }
  }
}

console.log(`Found ${missingZips.length} ZIP codes in the new list that are missing from the existing list`);

// Create CSV with missing ZIP codes
const outputCsv = [header, ...missingZips].join('\n');
fs.writeFileSync('missing-texas-zips.csv', outputCsv);

console.log('Created missing-texas-zips.csv with the missing ZIP codes');
console.log('\nFirst 10 missing ZIP codes:');
missingZips.slice(0, 10).forEach(line => {
  const zip = line.split(',')[0];
  console.log(`  ${zip}`);
});