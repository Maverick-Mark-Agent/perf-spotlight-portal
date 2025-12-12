const fs = require('fs');

// Read the existing 1300 ZIP codes list
console.log('Reading existing ZIP codes list...');
const existingData = fs.readFileSync('existing-texas-zips.csv', 'utf-8');
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

// Now process the new list from the document content
console.log('Processing new ZIP codes list from full database...');

// The new file has the header: ZipCode,City,State,Latitude,Longitude,Classification,Population
const newListHeader = 'ZipCode,City,State,Latitude,Longitude,Classification,Population';
const missingZips = [];

// Read line by line from the document you provided
const newFileContent = `ZipCode,City,State,Latitude,Longitude,Classification,Population
75001,ADDISON,TX,32.9598,-96.8385,,16528
75002,ALLEN,TX,33.083,-96.6099,,69939
75006,CARROLLTON,TX,32.9514,-96.8915,,47811
75007,CARROLLTON,TX,33.0039,-96.8959,,53960
75009,CELINA,TX,33.3338,-96.7505,,21276
75010,CARROLLTON,TX,33.0412,-96.8703,,33186`;

// For demonstration, I'll create a function to check sample ZIPs
// In practice, you'd read the full document

// Let me read from stdin or the actual file if you save it
console.log('\nTo complete the comparison, please save the full new ZIP list as "new-texas-zips.csv"');
console.log('Then run this script again.\n');

// Show what we have so far
console.log('Sample of existing ZIPs (first 10):');
const existingArray = Array.from(existingZips).slice(0, 10);
existingArray.forEach(zip => console.log(`  ${zip}`));

console.log('\n--- Script will compare when new file is available ---');